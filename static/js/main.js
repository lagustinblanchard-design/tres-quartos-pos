// Auto-cerrar alertas después de 4 segundos
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.alert').forEach(function(alert) {
    setTimeout(function() {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(function() { alert.remove(); }, 500);
    }, 4000);
  });
});
