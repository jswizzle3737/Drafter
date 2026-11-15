"use strict";(()=>{var p="data-drafter-trigger-attached",h="drafter-inline-trigger-host",u="drafter.preferences",l=null,i=null,s=!0;function T(e){if(!(e instanceof HTMLElement)||e.id===h)return!1;if(e.tagName==="TEXTAREA"){let t=e;return!(t.readOnly||t.disabled||`${t.name} ${t.id} ${t.placeholder}`.toLowerCase().includes("subject")&&t.rows<=2)}return!!e.isContentEditable}function b(){if(l&&document.contains(l))return l;let e=Array.from(document.querySelectorAll('textarea:not([readonly]):not([disabled]), [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]')).filter(t=>{if(!T(t))return!1;let n=t.getBoundingClientRect();return n.width>=160&&n.height>=60});return e.length===0?null:(e.sort((t,n)=>{let r=t.getBoundingClientRect(),a=n.getBoundingClientRect();return a.width*a.height-r.width*r.height}),e[0])}function m(){return Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).find(t=>`${t.name} ${t.id} ${t.placeholder} ${t.getAttribute("aria-label")??""}`.toLowerCase().includes("subject"))??null}function w(){let e=document.querySelector('input[name*="to" i], input[aria-label*="to" i], input[type="email"]');if(e?.value?.includes("@"))return e.value.trim();let n=(document.body?.innerText??"").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);return n?n[0]:""}function L(){let e=m();if(e?.value?.trim())return e.value.trim();let n=document.querySelector("h1, h2, [data-subject]")?.textContent?.trim()??"";return n||document.title.trim()}function A(){let e=[],t=["[data-thread]","[data-message-body]",".email-body",".message-body",".job-description","#job-details",'[data-testid*="job" i]',"article","main",'[role="main"]',"blockquote"];for(let o of t){for(let v of Array.from(document.querySelectorAll(o))){let c=v.innerText?.trim();c&&c.length>20&&!e.includes(c)&&e.push(c)}if(e.join(`

`).length>=6e3)break}if(e.length>0)return e.join(`

`).slice(0,6e3);let n=b(),r=(document.body?.innerText??"").split(`
`).map(o=>o.trim()).filter(o=>o.length>0&&o!=="\u2726 Draft"&&o!=="+ Draft"),a=n instanceof HTMLTextAreaElement?n.value:n?.innerText??"";return(a?r.filter(o=>!a.includes(o)):r).slice(0,80).join(`
`).slice(0,6e3)}function E(e=""){let t=L(),n=w(),r=!!m()||!!n||/mail|inbox|compose/i.test(location.href+" "+document.title),a=typeof window<"u"?window.getSelection()?.toString()??"":"",f=e.trim()||a.trim()||A();return{kind:r?"email":"webpage",title:document.title||location.hostname,subject:t,recipient:n,threadText:f,url:location.href,hostname:location.hostname,capturedAt:new Date().toISOString()}}function y(e){if(!i||!s)return;let t=e.getBoundingClientRect();if(t.width<120||t.height<48){i.style.display="none";return}i.style.display="block",i.style.top=`${Math.max(8,t.bottom+window.scrollY-38)}px`,i.style.left=`${Math.max(8,t.right+window.scrollX-88)}px`}function g(e){if(s){if(l=e,!i){i=document.createElement("div"),i.id=h,i.style.position="absolute",i.style.zIndex="2147483646";let t=i.attachShadow({mode:"open"});t.innerHTML=`
      <style>
        button {
          all: unset;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 999px;
          background: #ffffff;
          color: #0b8043;
          border: 1px solid #9ad9b6;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease;
        }
        button:hover {
          background: #eefbf4;
          transform: translateY(-1px);
        }
      </style>
      <button type="button" aria-label="Draft with Drafter">\u2726 Draft</button>
    `;let n=t.querySelector("button");n?.addEventListener("mousedown",r=>r.preventDefault()),n?.addEventListener("click",()=>{let r=E();chrome.runtime.sendMessage({type:"DRAFTER_OPEN_WITH_CONTEXT",context:r})}),document.body.appendChild(i)}y(e)}}function d(){if(!s){i&&(i.style.display="none");return}document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]').forEach(n=>{T(n)&&(n.hasAttribute(p)||(n.setAttribute(p,"true"),n.addEventListener("focus",()=>g(n))))});let t=b();t&&g(t)}function M(e,t){let n=m();n&&e.trim()&&(n.value=e.trim(),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})));let r=b();if(!r)return{ok:!1,targetLabel:""};if(r instanceof HTMLTextAreaElement)r.focus(),r.value=t,r.dispatchEvent(new Event("input",{bubbles:!0})),r.dispatchEvent(new Event("change",{bubbles:!0}));else if(r.isContentEditable){r.focus(),r.innerText=t;try{r.dispatchEvent(new InputEvent("input",{bubbles:!0,inputType:"insertText",data:t}))}catch{r.dispatchEvent(new Event("input",{bubbles:!0}))}r.dispatchEvent(new Event("change",{bubbles:!0}))}return{ok:!0,targetLabel:r.getAttribute("aria-label")||"Message Body"}}chrome.runtime.onMessage.addListener((e,t,n)=>{if(e?.type==="CAPTURE_PAGE_CONTEXT"){let r=E(e.selectionText??"");return n({ok:!0,context:r}),!0}if(e?.type==="INSERT_DRAFT_TEXT"){let r=M(String(e.subject??""),String(e.body??""));return n(r),!0}return!1});try{chrome.storage?.local?.get(u,e=>{let t=e?.[u];t&&typeof t.inlineWebmailTrigger=="boolean"&&(s=t.inlineWebmailTrigger),d()}),chrome.storage?.onChanged?.addListener(e=>{e[u]?.newValue&&(s=!!e[u].newValue.inlineWebmailTrigger,d())})}catch{d()}var x=()=>{l&&document.contains(l)&&y(l)};window.addEventListener("resize",x,{passive:!0});window.addEventListener("scroll",x,{passive:!0,capture:!0});var S=new MutationObserver(()=>{d()});document.body&&S.observe(document.body,{childList:!0,subtree:!0});})();
