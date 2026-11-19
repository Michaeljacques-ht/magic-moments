let installPrompt;
const button=document.getElementById('installApp'),help=document.getElementById('installHelp');
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function update(){button.hidden=installed();if(installed())button.classList.add('hidden');}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>{installPrompt=null;button.classList.add('hidden');help.classList.add('hidden');});
button.addEventListener('click',async()=>{if(installPrompt){const p=installPrompt;installPrompt=null;try{await p.prompt();await p.userChoice;return;}catch{}}help.textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'Dans Safari, touchez Partager puis Sur l’écran d’accueil.':'Dans le menu du navigateur, choisissez Installer l’application ou Ajouter à l’écran d’accueil, si disponible.';help.classList.remove('hidden');});
update();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('PWA:',e.message)));
