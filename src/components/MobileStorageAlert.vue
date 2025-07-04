<template>
  <div v-if="showAlert" class="mobile-storage-alert">
    <div class="alert-content">
      <div class="alert-icon">
        <i class="fas fa-mobile-alt"></i>
      </div>
      <div class="alert-message">
        <h4>{{ alertTitle }}</h4>
        <p>{{ alertMessage }}</p>
        <div class="alert-actions">
          <button @click="handleAction" class="action-btn">{{ actionText }}</button>
          <button @click="dismissAlert" class="dismiss-btn">Ignorer</button>
        </div>
      </div>
      <button @click="dismissAlert" class="close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted } from 'vue'
import { useStore } from 'vuex'

export default {
  name: 'MobileStorageAlert',
  setup() {
    const store = useStore()
    const showAlert = ref(false)
    const alertTitle = ref('')
    const alertMessage = ref('')
    const actionText = ref('')
    const alertType = ref('')

    // Détecter l'environnement mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent)
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches

    // Tester la disponibilité du localStorage
    const testLocalStorage = () => {
      try {
        const test = '__test_mobile_storage__'
        localStorage.setItem(test, 'test')
        localStorage.removeItem(test)
        return true
      } catch (e) {
        return false
      }
    }

    // Vérifier l'espace de stockage disponible
    const checkStorageQuota = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate()
          const usage = estimate.usage || 0
          const quota = estimate.quota || 0
          const usagePercent = quota > 0 ? (usage / quota) * 100 : 0
          
          console.log('[MOBILE] Utilisation du stockage:', {
            usage: Math.round(usage / 1024 / 1024) + ' MB',
            quota: Math.round(quota / 1024 / 1024) + ' MB',
            percent: Math.round(usagePercent) + '%'
          })
          
          return usagePercent
        } catch (e) {
          console.error('[MOBILE] Erreur lors de la vérification du quota:', e)
          return 0
        }
      }
      return 0
    }

    // Afficher une alerte spécifique
    const showStorageAlert = (type) => {
      alertType.value = type
      
      switch (type) {
        case 'ios_private':
          alertTitle.value = 'Mode privé détecté'
          alertMessage.value = 'Votre navigateur Safari est en mode privé. Vos tâches pourraient ne pas être sauvegardées correctement.'
          actionText.value = 'Ouvrir en normal'
          break
          
        case 'ios_standalone':
          alertTitle.value = 'Mode App séparé'
          alertMessage.value = 'Vous utilisez l\'app depuis l\'écran d\'accueil. Les données ne sont pas partagées avec Safari normal.'
          actionText.value = 'Synchroniser'
          break
          
        case 'storage_full':
          alertTitle.value = 'Stockage presque plein'
          alertMessage.value = 'L\'espace de stockage de votre appareil est presque plein. Cela peut affecter la sauvegarde de vos tâches.'
          actionText.value = 'Libérer l\'espace'
          break
          
        case 'storage_failed':
          alertTitle.value = 'Problème de sauvegarde'
          alertMessage.value = 'Impossible de sauvegarder vos tâches localement. Utilisez la synchronisation serveur.'
          actionText.value = 'Synchroniser'
          break
          
        case 'data_recovered':
          alertTitle.value = 'Données récupérées'
          alertMessage.value = 'Vos tâches ont été automatiquement récupérées après une perte de données.'
          actionText.value = 'Synchroniser'
          break
          
        default:
          return
      }
      
      showAlert.value = true
    }

    // Gérer l'action de l'alerte
    const handleAction = () => {
      switch (alertType.value) {
        case 'ios_private':
          // Rediriger vers l'ouverture en mode normal
          window.open(window.location.href, '_blank')
          break
          
        case 'ios_standalone':
        case 'storage_failed':
        case 'data_recovered':
          // Forcer la synchronisation
          store.dispatch('forceSyncToServer')
          break
          
        case 'storage_full':
          // Ouvrir les paramètres de stockage (si possible)
          if ('storage' in navigator && 'persisted' in navigator.storage) {
            navigator.storage.persisted().then(persistent => {
              if (!persistent) {
                navigator.storage.persist().then(granted => {
                  console.log('[MOBILE] Stockage persistant:', granted ? 'accordé' : 'refusé')
                })
              }
            })
          }
          break
      }
      
      dismissAlert()
    }

    // Fermer l'alerte
    const dismissAlert = () => {
      showAlert.value = false
      // Enregistrer que l'utilisateur a vu cette alerte
      try {
        const alertsSeen = JSON.parse(localStorage.getItem('mobile_alerts_seen') || '{}')
        alertsSeen[alertType.value] = Date.now()
        localStorage.setItem('mobile_alerts_seen', JSON.stringify(alertsSeen))
      } catch (e) {
        console.error('[MOBILE] Erreur lors de l\'enregistrement de l\'alerte:', e)
      }
    }

    // Vérifier si une alerte a déjà été vue récemment
    const hasSeenAlertRecently = (type, hours = 24) => {
      try {
        const alertsSeen = JSON.parse(localStorage.getItem('mobile_alerts_seen') || '{}')
        const lastSeen = alertsSeen[type]
        if (!lastSeen) return false
        
        const hoursAgo = (Date.now() - lastSeen) / (1000 * 60 * 60)
        return hoursAgo < hours
      } catch (e) {
        return false
      }
    }

    // Vérifications automatiques
    const performChecks = async () => {
      if (!isMobile) return

      console.log('[MOBILE] Vérifications de stockage mobile...')
      
      // Vérifier le mode privé iOS
      if (isIOSSafari && !testLocalStorage() && !hasSeenAlertRecently('ios_private', 6)) {
        showStorageAlert('ios_private')
        return
      }

      // Vérifier le mode standalone iOS
      if (isIOSSafari && isStandalone && !hasSeenAlertRecently('ios_standalone', 24)) {
        showStorageAlert('ios_standalone')
        return
      }

      // Vérifier l'espace de stockage
      const storageUsage = await checkStorageQuota()
      if (storageUsage > 90 && !hasSeenAlertRecently('storage_full', 12)) {
        showStorageAlert('storage_full')
        return
      }

      // Vérifier les échecs de stockage
      if (!testLocalStorage() && !hasSeenAlertRecently('storage_failed', 6)) {
        showStorageAlert('storage_failed')
        return
      }
    }

    // Écouter les événements de récupération de données
    const handleDataRecovery = () => {
      if (!hasSeenAlertRecently('data_recovered', 1)) {
        showStorageAlert('data_recovered')
      }
    }

    onMounted(() => {
      // Lancer les vérifications après un délai
      setTimeout(performChecks, 2000)
      
      // Écouter les événements personnalisés
      window.addEventListener('mobileDataRecovered', handleDataRecovery)
    })

    return {
      showAlert,
      alertTitle,
      alertMessage,
      actionText,
      handleAction,
      dismissAlert
    }
  }
}
</script>

<style scoped>
.mobile-storage-alert {
  position: fixed;
  top: 20px;
  left: 20px;
  right: 20px;
  z-index: 9999;
  animation: slideDown 0.3s ease-out;
}

.alert-content {
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  color: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  backdrop-filter: blur(10px);
}

.alert-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-message {
  flex: 1;
}

.alert-message h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.alert-message p {
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.4;
  opacity: 0.9;
}

.alert-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn, .dismiss-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.dismiss-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

@keyframes slideDown {
  from {
    transform: translateY(-100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 480px) {
  .mobile-storage-alert {
    top: 10px;
    left: 10px;
    right: 10px;
  }
  
  .alert-content {
    padding: 12px;
    gap: 8px;
    border-radius: 8px;
  }
  
  .alert-icon {
    font-size: 20px;
  }
  
  .alert-message h4 {
    font-size: 14px;
  }
  
  .alert-message p {
    font-size: 13px;
  }
  
  .alert-actions {
    gap: 6px;
  }
  
  .action-btn, .dismiss-btn {
    font-size: 11px;
    padding: 5px 10px;
  }
}

/* Styles pour très petits écrans */
@media (max-width: 360px) {
  .mobile-storage-alert {
    top: 5px;
    left: 5px;
    right: 5px;
  }
  
  .alert-content {
    padding: 10px;
    gap: 6px;
    border-radius: 6px;
    flex-direction: column;
    text-align: center;
  }
  
  .alert-icon {
    font-size: 18px;
    align-self: center;
    margin-bottom: 4px;
  }
  
  .alert-message {
    width: 100%;
  }
  
  .alert-message h4 {
    font-size: 13px;
    margin-bottom: 6px;
  }
  
  .alert-message p {
    font-size: 12px;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  
  .alert-actions {
    width: 100%;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
  }
  
  .action-btn, .dismiss-btn {
    flex: 1;
    font-size: 10px;
    padding: 6px 8px;
    border-radius: 4px;
    min-height: 32px;
  }
  
  .close-btn {
    top: 6px;
    right: 6px;
    font-size: 14px;
    padding: 2px;
  }
}

/* Amélioration pour mode paysage mobile */
@media (max-width: 768px) and (orientation: landscape) {
  .mobile-storage-alert {
    top: 5px;
    left: 5px;
    right: 5px;
    max-height: calc(100vh - 20px);
  }
  
  .alert-content {
    padding: 8px 12px;
    max-height: none;
    overflow-y: auto;
  }
  
  .alert-message h4 {
    font-size: 12px;
    margin-bottom: 4px;
  }
  
  .alert-message p {
    font-size: 11px;
    margin-bottom: 6px;
  }
  
  .alert-actions {
    gap: 4px;
  }
  
  .action-btn, .dismiss-btn {
    font-size: 10px;
    padding: 4px 8px;
  }
}

/* Amélioration de l'accessibilité mobile */
@media (max-width: 768px) {
  .action-btn, .dismiss-btn, .close-btn {
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }
  
  .action-btn:active, .dismiss-btn:active, .close-btn:active {
    transform: scale(0.95);
  }
  
  .alert-content {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }
  
  /* Amélioration du contraste pour mobile */
  .alert-message h4 {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .alert-message p {
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  }
}

/* Optimisation pour les connexions lentes */
@media (prefers-reduced-motion: reduce) {
  @keyframes slideDown {
    from {
      transform: translateY(-50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .mobile-storage-alert {
    animation-duration: 0.1s;
  }
}
</style> 