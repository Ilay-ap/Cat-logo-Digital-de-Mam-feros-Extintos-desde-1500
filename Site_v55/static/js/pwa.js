// PWA Registration and Management
// Catálogo de Mamíferos Extintos - V49

(function() {
  'use strict';

  // Verificar suporte a Service Worker
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers não são suportados neste navegador');
    return;
  }

  // Registrar Service Worker quando a página carregar
  window.addEventListener('load', () => {
    registerServiceWorker();
    setupInstallPrompt();
    checkForUpdates();
  });

  // Registrar Service Worker
  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/static/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);

      // Verificar atualizações
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] Nova versão do Service Worker encontrada');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nova versão disponível
            showUpdateNotification();
          }
        });
      });

      // Verificar atualizações periodicamente (a cada hora)
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

    } catch (error) {
      console.error('[PWA] Falha ao registrar Service Worker:', error);
    }
  }

  // Configurar prompt de instalação
  let deferredPrompt;

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevenir o prompt automático
      e.preventDefault();
      deferredPrompt = e;

      // Mostrar botão de instalação personalizado
      showInstallButton();
    });

    // Detectar quando o app foi instalado
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App instalado com sucesso');
      deferredPrompt = null;
      hideInstallButton();
      
      // Mostrar mensagem de sucesso
      showNotification('App instalado com sucesso! 🎉', 'success');
    });
  }

  // Mostrar botão de instalação
  function showInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'block';
      installBtn.addEventListener('click', installApp);
    } else {
      // Criar botão dinamicamente se não existir
      createInstallButton();
    }
  }

  // Criar botão de instalação dinamicamente
  function createInstallButton() {
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-button';
    btn.innerHTML = '📱 Instalar App';
    btn.setAttribute('aria-label', 'Instalar aplicativo');
    
    // Estilos inline para garantir visibilidade
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });
    
    btn.addEventListener('click', installApp);
    document.body.appendChild(btn);
  }

  // Esconder botão de instalação
  function hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  // Instalar app
  async function installApp() {
    if (!deferredPrompt) {
      return;
    }

    // Mostrar prompt de instalação
    deferredPrompt.prompt();

    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Escolha do usuário:', outcome);

    if (outcome === 'accepted') {
      console.log('[PWA] Usuário aceitou a instalação');
    } else {
      console.log('[PWA] Usuário recusou a instalação');
    }

    // Limpar o prompt
    deferredPrompt = null;
    hideInstallButton();
  }

  // Mostrar notificação de atualização
  function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'pwa-update-notification';
    notification.innerHTML = `
      <div class="pwa-update-content">
        <p><strong>🔄 Nova versão disponível!</strong></p>
        <p>Clique para atualizar o aplicativo.</p>
        <div class="pwa-update-buttons">
          <button id="pwa-update-btn" class="pwa-btn pwa-btn-primary">Atualizar Agora</button>
          <button id="pwa-dismiss-btn" class="pwa-btn pwa-btn-secondary">Mais Tarde</button>
        </div>
      </div>
    `;

    // Estilos inline
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 350px;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Botão de atualizar
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
      }
      window.location.reload();
    });

    // Botão de dispensar
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      notification.remove();
    });
  }

  // Verificar atualizações
  function checkForUpdates() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      });
    }
  }

  // Mostrar notificação genérica
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `pwa-notification pwa-notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      font-weight: 500;
    `;

    document.body.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Adicionar estilos de animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    .pwa-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .pwa-btn-primary {
      background: #3b82f6;
      color: white;
    }

    .pwa-btn-primary:hover {
      background: #2563eb;
    }

    .pwa-btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }

    .pwa-btn-secondary:hover {
      background: #d1d5db;
    }

    .pwa-update-buttons {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }

    .pwa-update-content p {
      margin: 0 0 8px 0;
    }

    @media (max-width: 768px) {
      .pwa-install-button,
      .pwa-update-notification {
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);

  // Detectar se está rodando como PWA instalado
  function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  if (isPWA()) {
    console.log('[PWA] Rodando como aplicativo instalado');
    document.body.classList.add('pwa-installed');
  }

  // Exportar funções úteis
  window.PWA = {
    isPWA,
    checkForUpdates,
    clearCache: async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
        console.log('[PWA] Cache limpo');
      }
    }
  };

  console.log('[PWA] PWA Manager inicializado');
})();
