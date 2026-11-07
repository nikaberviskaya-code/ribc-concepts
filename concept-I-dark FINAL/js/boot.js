/* Анимационный режим включаем до первого кадра, чтобы не мигал контент. */
(function () {
  var r = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!r) document.documentElement.classList.add('anim');
  setTimeout(function () { /* страховка: если скрипты не загрузились — показываем всё */
    if (!window.__ribcReady) document.documentElement.classList.remove('anim');
  }, 5000);
})();
