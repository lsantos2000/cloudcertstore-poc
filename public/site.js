(() => {
  const menuButton = document.querySelector('.menu-button');
  const mobileNav = document.querySelector('#mobile-nav');
  if (menuButton && mobileNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
    });
    mobileNav.addEventListener('click', () => {
      mobileNav.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
    });
  }

  const banner = document.querySelector('#cookie-banner');
  if (banner) {
    try {
      const dismissed = localStorage.getItem('ccs-cookie-notice-dismissed') === '1';
      banner.hidden = dismissed;
    } catch (_) {
      banner.hidden = false;
    }
    banner.querySelector('[data-cookie-action="dismiss"]')?.addEventListener('click', () => {
      try { localStorage.setItem('ccs-cookie-notice-dismissed', '1'); } catch (_) {}
      banner.hidden = true;
    });
  }
})();
