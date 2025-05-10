/**
 * Script d'aide à la configuration SMTP pour l'API TodoList
 * Ce script guide l'utilisateur pour configurer les variables d'environnement
 * nécessaires à l'envoi d'emails via SMTP.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Créer l'interface de lecture
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Chemin du fichier .env
const envPath = path.join(__dirname, '../.env');

// Fonction pour poser une question et obtenir une réponse
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Fonction pour lire le fichier .env existant
const readEnvFile = () => {
  try {
    if (fs.existsSync(envPath)) {
      return fs.readFileSync(envPath, 'utf8');
    }
    return '';
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier .env:', error.message);
    return '';
  }
};

// Fonction pour écrire dans le fichier .env
const writeEnvFile = (content) => {
  try {
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`\nFichier .env mis à jour avec succès: ${envPath}`);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans le fichier .env:', error.message);
    return false;
  }
};

// Fonction pour extraire une variable d'un fichier .env
const extractEnvVar = (content, varName) => {
  const regex = new RegExp(`^${varName}=(.*)$`, 'm');
  const match = content.match(regex);
  return match ? match[1].replace(/["']/g, '') : '';
};

// Fonction pour mettre à jour une variable dans le contenu .env
const updateEnvVar = (content, varName, varValue) => {
  // Nettoyer la valeur des guillemets
  const cleanValue = varValue.replace(/["']/g, '');
  
  // Échapper les caractères spéciaux pour les expressions régulières
  const escapedVarName = varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  // Vérifier si la variable existe déjà
  const regex = new RegExp(`^${escapedVarName}=.*$`, 'm');
  
  if (regex.test(content)) {
    // Remplacer la valeur existante
    return content.replace(regex, `${varName}=${cleanValue}`);
  } else {
    // Ajouter la nouvelle variable
    return `${content}\n${varName}=${cleanValue}`;
  }
};

// Fonction principale
const main = async () => {
  console.log('===========================================');
  console.log('   Configuration SMTP pour TodoList API    ');
  console.log('===========================================');
  console.log('\nCe script va vous aider à configurer les paramètres SMTP');
  console.log('pour permettre l\'envoi d\'emails dans votre application.');
  console.log('\nOptions disponibles:');
  console.log('1. Gmail (recommandé)');
  console.log('2. Autre service SMTP');
  
  let choice = await question('\nChoisissez une option (1/2): ');
  
  // Lire le fichier .env existant
  let envContent = readEnvFile();
  
  // Variables à configurer
  let smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, email_from;
  
  if (choice === '1') {
    // Configuration pour Gmail
    console.log('\n--- Configuration Gmail ---');
    console.log('Pour Gmail, vous devez utiliser un "mot de passe d\'application"');
    console.log('Créez-en un ici: https://myaccount.google.com/apppasswords');
    console.log('(Nécessite l\'authentification à deux facteurs activée)');
    
    smtp_host = 'smtp.gmail.com';
    smtp_port = '587';
    smtp_secure = 'false';
    
    smtp_user = await question('\nVotre adresse Gmail: ');
    smtp_pass = await question('Votre mot de passe d\'application: ');
    email_from = smtp_user; // Utiliser la même adresse pour l'expéditeur
  } else {
    // Configuration pour un autre service SMTP
    console.log('\n--- Configuration SMTP personnalisée ---');
    
    smtp_host = await question('Hôte SMTP (ex: smtp.example.com): ');
    smtp_port = await question('Port SMTP (ex: 587): ');
    smtp_secure = await question('Connexion sécurisée (true/false, généralement false pour le port 587): ');
    smtp_user = await question('Nom d\'utilisateur SMTP: ');
    smtp_pass = await question('Mot de passe SMTP: ');
    email_from = await question('Adresse email d\'expédition: ');
  }
  
  // Mettre à jour les variables dans le contenu .env
  envContent = updateEnvVar(envContent, 'SMTP_HOST', smtp_host);
  envContent = updateEnvVar(envContent, 'SMTP_PORT', smtp_port);
  envContent = updateEnvVar(envContent, 'SMTP_SECURE', smtp_secure);
  envContent = updateEnvVar(envContent, 'SMTP_USER', smtp_user);
  envContent = updateEnvVar(envContent, 'SMTP_PASS', smtp_pass);
  envContent = updateEnvVar(envContent, 'EMAIL_FROM', email_from);
  
  // Écrire le fichier .env mis à jour
  if (writeEnvFile(envContent)) {
    console.log('\nConfiguration SMTP terminée avec succès!');
    console.log('\nParamètres configurés:');
    console.log(`- SMTP_HOST: ${smtp_host}`);
    console.log(`- SMTP_PORT: ${smtp_port}`);
    console.log(`- SMTP_SECURE: ${smtp_secure}`);
    console.log(`- SMTP_USER: ${smtp_user}`);
    console.log(`- SMTP_PASS: ${'*'.repeat(smtp_pass.length)}`);
    console.log(`- EMAIL_FROM: ${email_from}`);
    
    console.log('\nPour tester la configuration:');
    console.log('1. Redémarrez votre serveur');
    console.log('2. Accédez à /api/notifications/test-smtp?email=votre@email.com dans votre navigateur');
    
    // Proposer de déployer sur Vercel
    const deployVercel = await question('\nSouhaitez-vous déployer ces variables sur Vercel ? (o/n): ');
    
    if (deployVercel.toLowerCase() === 'o') {
      console.log('\nPour déployer sur Vercel, exécutez les commandes suivantes:');
      console.log('vercel login');
      console.log('vercel --prod');
      
      const runVercel = await question('\nSouhaitez-vous exécuter ces commandes maintenant ? (o/n): ');
      
      if (runVercel.toLowerCase() === 'o') {
        console.log('\nExécution de vercel login...');
        exec('vercel login', (error, stdout, stderr) => {
          if (error) {
            console.error(`Erreur: ${error.message}`);
            rl.close();
            return;
          }
          
          console.log(stdout);
          
          console.log('\nExécution de vercel --prod...');
          exec('vercel --prod', (error, stdout, stderr) => {
            if (error) {
              console.error(`Erreur: ${error.message}`);
            } else {
              console.log(stdout);
              console.log('\nDéploiement terminé! Vos variables d\'environnement sont maintenant configurées sur Vercel.');
            }
            rl.close();
          });
        });
      } else {
        rl.close();
      }
    } else {
      rl.close();
    }
  } else {
    console.log('\nÉchec de la configuration. Veuillez réessayer.');
    rl.close();
  }
};

// Exécuter le script
main(); 