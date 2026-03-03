const cards = document.querySelectorAll('.card');

cards.forEach((card, index) => {
  card.animate(
    [
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0px)' },
    ],
    {
      duration: 450,
      delay: 120 * index,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      fill: 'both',
    }
  );
});
