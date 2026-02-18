// main.js - Frontend-Logik für Angel-Event-Planer
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Angel-Event-Planer geladen');
    
    // Alert bei Klick auf Teilnehmen (später durch PayPal ersetzt)
    const payButtons = document.querySelectorAll('.btn-pay');
    payButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const eventName = button.dataset.eventName;
            const amount = button.dataset.amount;
            alert(`Demo: Teilnahme an "${eventName}" für ${amount}€ (PayPal folgt später)`);
        });
    });
});
