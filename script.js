// script.js - Version Débloquée

document.addEventListener("DOMContentLoaded", function() {
    const countdownElement = document.getElementById("countdown");
    const ctaButton = document.querySelector(".cta-button");

    // On affiche directement l'état connecté
    countdownElement.innerHTML = "SYSTEM_ONLINE";
    countdownElement.style.color = "#0f0"; // Vert néon pour indiquer que c'est prêt
    
    // Optionnel : Changer le texte du bouton
    ctaButton.innerHTML = "ENTRER DANS LA MATRICE";
    
    // Le bouton pointe maintenant vers une vraie destination (à modifier)
    ctaButton.href = "https://votre-site-final.com"; 
});