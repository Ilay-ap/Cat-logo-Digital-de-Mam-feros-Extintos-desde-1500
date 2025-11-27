(function() {
    'use strict';
    const COOKIE_NAME = 'cookie_consent';
    const COOKIE_EXPIRY_DAYS = 365;
    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
    }
    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    function hasConsent() {
        return getCookie(COOKIE_NAME) !== null;
    }
    function loadClarityScript() {
        if (!window.CLARITY_PROJECT_ID) {
            console.warn('Microsoft Clarity: ID do projeto não definido');
            return;
        }
        if (typeof clarity === 'function') {
            console.log('Microsoft Clarity: Já carregado');
            return;
        }
        console.log('Microsoft Clarity: Carregando script após consentimento...');
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", window.CLARITY_PROJECT_ID);
        console.log('Microsoft Clarity: Script carregado com sucesso');
    }
    function acceptCookies() {
        setCookie(COOKIE_NAME, 'accepted', COOKIE_EXPIRY_DAYS);
        hideBanner();
        loadClarityScript();
        console.log('✅ Cookies aceitos - Analytics ativado');
    }
    function rejectCookies() {
        setCookie(COOKIE_NAME, 'rejected', COOKIE_EXPIRY_DAYS);
        hideBanner();
        console.log('❌ Cookies rejeitados - Analytics desativado');
        console.log('Microsoft Clarity: Script NÃO será carregado');
    }
    function showBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.style.display = 'block';
            setTimeout(() => {
                banner.classList.add('show');
                console.log('✅ Banner de cookies exibido');
            }, 100);
        } else {
            console.error('❌ Banner de cookies não encontrado no DOM');
        }
    }
    function hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.style.display = 'none';
            }, 400);
            console.log('✅ Banner de cookies ocultado');
        }
    }
    function init() {
        const consent = getCookie(COOKIE_NAME);
        if (!consent) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showBanner);
            } else {
                showBanner();
            }
        } else if (consent === 'accepted') {
            console.log('✅ Consentimento previamente aceito');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', loadClarityScript);
            } else {
                loadClarityScript();
            }
        } else {
            console.log('❌ Consentimento previamente rejeitado');
        }
        document.addEventListener('DOMContentLoaded', function() {
            const acceptBtn = document.getElementById('cookie-accept');
            const rejectBtn = document.getElementById('cookie-reject');
            if (acceptBtn) {
                acceptBtn.addEventListener('click', acceptCookies);
            }
            if (rejectBtn) {
                rejectBtn.addEventListener('click', rejectCookies);
            }
        });
    }
    init();
    window.CookieConsent = {
        accept: acceptCookies,
        reject: rejectCookies,
        hasConsent: hasConsent,
        getStatus: function() {
            return getCookie(COOKIE_NAME);
        },
        reset: function() {
            document.cookie = COOKIE_NAME + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';
            console.log('🔄 Consentimento resetado. Recarregando página...');
            location.reload();
        },
        loadClarity: loadClarityScript
    };
})();
