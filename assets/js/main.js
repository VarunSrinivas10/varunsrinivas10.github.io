// Hamburger menu
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// Highlight active nav link
const links = document.querySelectorAll('.nav-links a');
const page  = location.pathname.split('/').pop() || 'index.html';
links.forEach(a => {
  const href = a.getAttribute('href');
  if (href === page || (page === '' && href === 'index.html')) {
    a.classList.add('active');
  }
});
