/* Icon bổ sung cho GD2/GD3 (Lucide-style 24x24, stroke 2). Dùng: <i data-xicon="user-x" data-size="24"></i>
   Không sửa icons.js dùng chung. Nạp sau icons.js (defer). */
(function () {
  var P = {
    'user-x': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    'check-check': '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
    'bell-off': '<path d="M8.7 3A6 6 0 0 1 18 8c0 2.7.5 4.6 1.1 6M17 17H3s3-2 3-9c0-.7.1-1.3.3-1.9M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"/>',
    'send': '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    'shield-alert': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4M12 16h.01"/>',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    'hourglass': '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.42A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.42A2 2 0 0 0 17 6.17V2"/>',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>'
  };
  function hyd(root) {
    (root || document).querySelectorAll('[data-xicon]').forEach(function (el) {
      var n = el.getAttribute('data-xicon'), s = parseInt(el.getAttribute('data-size') || '24', 10);
      var t = document.createElement('span');
      t.innerHTML = '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[n] || '') + '</svg>';
      el.replaceWith(t.firstChild);
    });
  }
  window.hydrateXIcons = hyd;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hyd(); }); else hyd();
})();
