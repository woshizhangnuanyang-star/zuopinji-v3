export const backgroundMusic={title:'云村的夏天',artist:'邱有句',page:'https://music.163.com/#/song?id=485663643',src:'https://music.163.com/song/media/outer/url?id=485663643.mp3'};
// Use the official public stream; no copied audio or expiring CDN address.
export function createSoundscape(onStatus=()=>{}) {
  const audio=document.createElement('audio');audio.src=backgroundMusic.src;audio.loop=true;audio.preload='none';audio.volume=.32;audio.hidden=true;audio.setAttribute('aria-hidden','true');audio.dataset.backgroundMusic=backgroundMusic.title;document.body.appendChild(audio);
  let destroyed=false;const error=()=>onStatus('error');audio.addEventListener('error',error);
  return {
    async toggle(){if(destroyed)return false;if(!audio.paused){audio.pause();onStatus('paused');return false;}onStatus('loading');try{if(audio.error)audio.load();await audio.play();if(destroyed){audio.pause();return false;}onStatus('playing');return true;}catch{onStatus('error');return false;}},
    setChapter(){},play(){},
    destroy(){destroyed=true;audio.pause();audio.removeEventListener('error',error);audio.removeAttribute('src');audio.load();audio.remove();},
  };
}
