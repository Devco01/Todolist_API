const jwt = require('jsonwebtoken');
const { getUserModel, syncUserModel } = require('../models/UserPg');
const { connectPostgres, getSequelize } = require('../config/postgres');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

// Clé secrète pour les JWT - à remplacer par une variable d'environnement en production
const JWT_SECRET = process.env.JWT_SECRET || 'votre_clé_secrète_jwt';
const TOKEN_EXPIRATION = '7d'; // 7 jours

// Initialiser le service d'authentification
const initAuthService = async () => {
  try {
    console.log('[AUTH] Initialisation du service d\'authentification...');
    
    // Si le mode mémoire est activé
    if (process.env.USE_MEMORY_MODE === 'true') {
      console.log('[AUTH] Mode mémoire activé pour le service d\'authentification');
      return true;
    }
    
    // CRITIQUE: Réutiliser la connexion existante pour éviter les reconnexions en boucle
    const sequelize = getSequelize();
    if (!sequelize) {
      // Seulement si pas de connexion existante, en créer une
      const connection = await connectPostgres();
      console.log('[AUTH] Résultat de la connexion PostgreSQL:', connection ? 'Succès' : 'Échec');
    } else {
      console.log('[AUTH] Réutilisation de la connexion PostgreSQL existante');
    }
    
    // Vérifier si le modèle User est disponible
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Erreur: Modèle User non disponible');
      return false;
    }
    
    console.log('[AUTH] Modèle User récupéré avec succès');
    
    // La synchronisation est maintenant gérée par initUserModel dans index.js
    console.log('[AUTH] Service d\'authentification initialisé avec succès');
    return true;
  } catch (error) {
    console.error('[AUTH] Erreur lors de l\'initialisation du service d\'authentification:', error);
    return false;
  }
};

// Enregistrer un nouvel utilisateur
const registerUser = async (userData) => {
  try {
    console.log('[AUTH] Tentative d\'enregistrement d\'un nouvel utilisateur:', userData.username);
    
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Modèle utilisateur non disponible');
      throw new Error('Modèle utilisateur non disponible');
    }
    
    // Vérifier si l'utilisateur existe déjà
    console.log('[AUTH] Vérification si l\'utilisateur existe déjà...');
    const existingUser = await UserModel.findOne({
      where: {
        [Op.or]: [
          { username: userData.username },
          { email: userData.email }
        ]
      }
    });
    
    if (existingUser) {
      console.log('[AUTH] Un utilisateur existe déjà avec ce nom ou cet email');
      throw new Error('Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà');
    }
    
    // Création d'un objet avec uniquement les champs nécessaires
    const userToCreate = {
      username: userData.username,
      email: userData.email,
      password: userData.password,
      isAdmin: userData.isAdmin || false
    };
    
    console.log('[AUTH] Création du nouvel utilisateur avec les données:', 
      { ...userToCreate, password: '***MASQUÉ***' });
    
    // Vérifier que notre UserModel est bien un modèle Sequelize et pas en mémoire
    console.log('[AUTH] Type de UserModel:', typeof UserModel.create, 'isUsingMemoryMode:', UserModel.isUsingMemoryMode === true);
    
    // Vérifier l'état de la connexion à la base de données
    const sequelize = getSequelize();
    let dbState = 'non disponible';
    if (sequelize) {
      try {
        const [result] = await sequelize.query('SELECT 1');
        dbState = result ? 'connectée' : 'problème de requête';
      } catch (dbError) {
        dbState = `erreur: ${dbError.message}`;
      }
    }
    console.log('[AUTH] État de la base de données:', dbState);
    
    // Créer l'utilisateur
    let newUser = await UserModel.create(userToCreate);
    
    console.log('[AUTH] Utilisateur créé avec succès:', newUser.id);
    
    // Générer un token JWT
    const token = generateToken(newUser);
    
    // Retourner l'utilisateur sans le mot de passe et le token
    const userResponse = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
      createdAt: newUser.createdAt
    };
    
    console.log('[AUTH] Enregistrement réussi pour:', userResponse.username);
    
    return {
      user: userResponse,
      token
    };
  } catch (error) {
    console.error('[AUTH] Erreur détaillée lors de l\'enregistrement:', error);
    
    if (error.name === 'SequelizeValidationError') {
      console.error('[AUTH] Erreurs de validation:', error.errors.map(e => e.message).join(', '));
    }
    
    throw error;
  }
};

// Connecter un utilisateur existant
const loginUser = async (username, password) => {
  try {
    console.log('[AUTH] Tentative de connexion pour l\'utilisateur:', username);
    
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Modèle utilisateur non disponible');
      throw new Error('Modèle utilisateur non disponible');
    }
    
    // Debug - Vérifier si la table User existe
    const sequelize = getSequelize();
    try {
      const [checkResults] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'User'
        );
      `);
      console.log('[AUTH] La table User existe:', checkResults[0]?.exists);
      
      // Obtenir le nombre d'utilisateurs
      const [countResults] = await sequelize.query('SELECT COUNT(*) FROM "User"');
      console.log('[AUTH] Nombre d\'utilisateurs dans la base:', countResults[0]?.count);
      
      // Rechercher spécifiquement l'utilisateur demandé
      const [userResults] = await sequelize.query(`
        SELECT id, username, email FROM "User" 
        WHERE username = :username OR email = :username
      `, {
        replacements: { username }
      });
      
      console.log('[AUTH] Recherche SQL directe pour utilisateur:', username);
      console.log('[AUTH] Résultat de la recherche directe:', userResults.length > 0 ? 'Trouvé' : 'Non trouvé');
      
      if (userResults.length === 0) {
        console.log('[AUTH] Aucun utilisateur trouvé avec ce nom/email via SQL direct');
      }
    } catch (dbError) {
      console.error('[AUTH] Erreur lors de la vérification de la base de données:', dbError);
    }
    
    // Chercher l'utilisateur par nom d'utilisateur ou email
    console.log('[AUTH] Recherche de l\'utilisateur avec Sequelize');
    let user = null;
    
    // Essayer d'abord par nom d'utilisateur
    try {
      user = await UserModel.findOne({
        where: { username }
      });
      
      if (!user) {
        console.log('[AUTH] Utilisateur non trouvé par nom d\'utilisateur, essai par email');
        // Essayer par email si le format semble être un email
        if (username.includes('@')) {
          user = await UserModel.findOne({
            where: { email: username }
          });
        }
      }
    } catch (findError) {
      console.error('[AUTH] Erreur lors de la recherche de l\'utilisateur:', findError);
      // Essayer avec une requête SQL directe en dernier recours
      try {
        const [results] = await sequelize.query(`
          SELECT * FROM "User" WHERE username = :username OR email = :username LIMIT 1
        `, {
          replacements: { username }
        });
        
        if (results.length > 0) {
          console.log('[AUTH] Utilisateur trouvé via SQL direct');
          const rawUser = results[0];
          
          // Créer un objet avec la méthode comparePassword
          user = {
            ...rawUser,
            comparePassword: async (candidatePassword) => {
              return bcrypt.compare(candidatePassword, rawUser.password);
            }
          };
        }
      } catch (sqlError) {
        console.error('[AUTH] Échec de la recherche SQL directe:', sqlError);
      }
    }
    
    if (!user) {
      console.log('[AUTH] Utilisateur non trouvé:', username);
      throw new Error('Utilisateur non trouvé');
    }
    
    console.log('[AUTH] Utilisateur trouvé, vérification du mot de passe');
    
    // Vérifier le mot de passe
    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
    } catch (compareError) {
      console.error('[AUTH] Erreur lors de la vérification du mot de passe:', compareError);
      
      // Solution de secours si comparePassword échoue
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } catch (bcryptError) {
        console.error('[AUTH] Échec également de bcrypt.compare:', bcryptError);
      }
    }
    
    if (!isPasswordValid) {
      console.log('[AUTH] Mot de passe incorrect pour:', username);
      throw new Error('Mot de passe incorrect');
    }
    
    // Générer un token JWT
    const token = generateToken(user);
    
    // Retourner l'utilisateur sans le mot de passe et le token
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };
    
    console.log('[AUTH] Connexion réussie pour:', userResponse.username);
    
    return {
      user: userResponse,
      token
    };
  } catch (error) {
    console.error('[AUTH] Erreur lors de la connexion de l\'utilisateur:', error);
    throw error;
  }
};

// Générer un token JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRATION
    }
  );
};

// Vérifier un token JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    return null;
  }
};

// Vérifier si un utilisateur existe
const userExists = async (username, email) => {
  try {
    const UserModel = getUserModel();
    if (!UserModel) {
      throw new Error('Modèle utilisateur non disponible');
    }
    
    const existingUser = await UserModel.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    return !!existingUser;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur:', error);
    throw error;
  }
};

// Récupérer un utilisateur par son ID
const getUserById = async (userId) => {
  try {
    console.log('[AUTH] Récupération de l\'utilisateur par ID:', userId);
    
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Modèle utilisateur non disponible');
      return null;
    }
    
    // Vérifier le format d'UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error(`[AUTH] Format d'ID utilisateur invalide: ${userId}`);
      return null;
    }
    
    // Vérifier si l'utilisateur existe
    try {
      const user = await UserModel.findByPk(userId);
      
      if (!user) {
        console.warn(`[AUTH] Utilisateur avec ID ${userId} non trouvé dans la base de données`);
        
        // Vérifier si c'est un problème de connexion à la base de données
        const sequelize = getSequelize();
        if (sequelize) {
          try {
            // Tester la connexion
            const [testResult] = await sequelize.query('SELECT 1 as test');
            const connectionOk = testResult && testResult.length > 0;
            
            if (!connectionOk) {
              console.error('[AUTH] Problème de connexion à la base de données lors de la récupération utilisateur');
            } else {
              console.log('[AUTH] Connexion à la base de données OK, utilisateur vraiment introuvable');
            }
          } catch (testError) {
            console.error('[AUTH] Erreur lors du test de connexion BDD:', testError);
          }
        }
        
        return null;
      }
      
      console.log('[AUTH] Utilisateur récupéré avec succès:', user.username);
      return user;
    } catch (error) {
      console.error('[AUTH] Erreur lors de la récupération de l\'utilisateur:', error);
      return null;
    }
  } catch (error) {
    console.error('[AUTH] Erreur lors de la récupération de l\'utilisateur par ID:', error);
    return null;
  }
};

module.exports = {
  initAuthService,
  registerUser,
  loginUser,
  verifyToken,
  userExists,
  getUserById
}; 