import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import {
  Eye, EyeOff, Trash2,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
} from 'lucide-react'
import type { CanvasElement, ElementData, TextRun } from '../../types'

const C = {
  bg:'#1e1e2e', border:'rgba(255,255,255,0.07)', muted:'#55557a', text:'#c8c8d8',
  accent:'#4f46e5', accentL:'rgba(79,70,229,0.22)', accentB:'#6366f1',
  hover:'rgba(255,255,255,0.06)', danger:'#f87171',
  input:'rgba(255,255,255,0.06)', inputBd:'rgba(255,255,255,0.12)',
}

const PRESET_FILLS = [
  'transparent','#ffffff','#f1f5f9','#e2e8f0',
  '#dbeafe','#dcfce7','#fef3c7','#fee2e2','#f3e8ff',
  '#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#1e40af','#166534','#92400e','#991b1b','#5b21b6',
  '#0f172a','#1e293b','#374151',
]
const PRESET_STROKES = [
  'transparent','#ffffff','#94a3b8','#64748b',
  '#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#0f172a',
]
const STROKE_WIDTHS = [0,1,2,3,4,6,8]

const STROKE_STYLES = [
  { id:'solid', dash:undefined as number[]|undefined,
    svg:<svg width="34" height="8"><line x1="2" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg> },
  { id:'dashed', dash:[16,8] as number[],
    svg:<svg width="34" height="8"><line x1="2" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10,6"/></svg> },
  { id:'dotted', dash:[3,8] as number[],
    svg:<svg width="34" height="8"><line x1="2" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3,6"/></svg> },
]

const SLOPPINESS = [
  { id:0, svg:<svg width="32" height="16" viewBox="0 0 32 16"><path d="M2 10 L30 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  { id:1, svg:<svg width="32" height="16" viewBox="0 0 32 16"><path d="M2 12 Q10 2 16 8 Q22 14 30 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  { id:2, svg:<svg width="32" height="16" viewBox="0 0 32 16"><path d="M2 13 Q6 2 11 9 Q14 14 18 5 Q23 0 30 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
]

const EDGES = [
  { id:'sharp', svg:<svg width="32" height="22" viewBox="0 0 32 22"><rect x="3" y="4" width="26" height="14" rx="0" fill="none" stroke="currentColor" strokeWidth="2"/></svg> },
  { id:'round', svg:<svg width="32" height="22" viewBox="0 0 32 22"><rect x="3" y="4" width="26" height="14" rx="6" fill="none" stroke="currentColor" strokeWidth="2"/></svg> },
]

const TYPE_ICON: Record<string,string> = {
  rect:'▭',circle:'●',line:'╱',arrow:'→',freehand:'✏',text:'T',image:'🖼',
  triangle:'△',star:'★',pentagon:'⬠',hexagon:'⬡',diamond:'◇',parallelogram:'▱',cylinder:'⊙',cross:'✚',
}
const TYPE_NAME: Record<string,string> = {
  rect:'Düzbucaqlı',circle:'Dairə',line:'Xətt',arrow:'Ok',freehand:'Çizgi',
  text:'Mətn',image:'Şəkil',triangle:'Üçbucaq',star:'Ulduz',pentagon:'Beşbucaq',
  hexagon:'Altıbucaq',diamond:'Romb',parallelogram:'Paraleloqram',cylinder:'Silindr',cross:'Xaç',
}

function Swatch({ color, selected, onClick }:{ color:string;selected:boolean;onClick:()=>void }) {
  const isT = color==='transparent'
  return (
      <button onClick={onClick} title={isT?'Şəffaf':color}
              style={{
                width:22,height:22,borderRadius:5,flexShrink:0,cursor:'pointer',
                border:selected?`2px solid ${C.accentB}`:`1.5px solid ${C.border}`,
                background:isT?undefined:color,
                position:'relative',overflow:'hidden',
                transform:selected?'scale(1.12)':'scale(1)',
                boxShadow:selected?`0 0 0 2px rgba(99,102,241,0.35)`:'none',
                transition:'all 0.1s',
              }}>
        {isT&&<div style={{ position:'absolute',inset:0,
          background:'linear-gradient(135deg,#555 25%,transparent 25%,transparent 75%,#555 75%),linear-gradient(135deg,#555 25%,#222 25%,#222 75%,#555 75%)',
          backgroundSize:'8px 8px',backgroundPosition:'0 0,4px 4px' }}/>}
      </button>
  )
}

function Lbl({ children }:{ children:React.ReactNode }) {
  return <p style={{ fontSize:10,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6 }}>{children}</p>
}
function Div() { return <div style={{ height:1,background:C.border,margin:'10px 0' }}/> }

const iSt: React.CSSProperties = {
  background:C.input,border:`1px solid ${C.inputBd}`,borderRadius:7,
  color:C.text,fontSize:11,padding:'5px 8px',outline:'none',width:'100%',
}

function OBtn({ active,onClick,children,title,flex=true }:{active:boolean;onClick:()=>void;children:React.ReactNode;title?:string;flex?:boolean}) {
  const [h,setH]=useState(false)
  return (
      <button onClick={onClick} title={title}
              onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
              style={{
                flex:flex?1:undefined,display:'flex',alignItems:'center',justifyContent:'center',
                padding:'5px 4px',borderRadius:7,cursor:'pointer',transition:'all 0.1s',
                border:active?`1px solid ${C.accentB}`:`1px solid ${C.border}`,
                background:active?C.accentL:h?C.hover:C.input,
                color:active?'#a5b4fc':h?C.text:C.muted,
              }}>{children}</button>
  )
}

function IBtn({ onClick,title,children }:{onClick:()=>void;title?:string;children:React.ReactNode}) {
  const [h,setH]=useState(false)
  return (
      <button onClick={onClick} title={title}
              onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
              style={{
                flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                height:30,borderRadius:7,border:`1px solid ${C.border}`,
                cursor:'pointer',transition:'all 0.1s',
                background:h?C.hover:C.input,color:h?C.text:C.muted,
              }}>{children}</button>
  )
}

function LayerList() {
  const { elements,selectedIds,setSelectedIds,bringForward,sendBackward,bringToFront,sendToBack,swapZIndex,updateElement } = useCanvasStore()
  const [hidden,setHidden]=useState<Set<string>>(new Set())
  const [dragOverId,setDragOverId]=useState<string|null>(null)
  const sorted=[...elements].sort((a,b)=>(b.z_index??0)-(a.z_index??0))
  const activeId=selectedIds.length===1?selectedIds[0]:null
  const toggleHide=(id:string)=>{
    setHidden(prev=>{ const n=new Set(prev); if(n.has(id)){n.delete(id);updateElement(id,{opacity:1})}else{n.add(id);updateElement(id,{opacity:0})}; return n })
  }
  return (
      <div>
        {activeId&&(
            <div style={{ display:'flex',gap:4,marginBottom:8 }}>
              {[
                { icon:<ChevronsDown size={12}/>,fn:()=>sendToBack(activeId),t:'Ən alta' },
                { icon:<ChevronDown size={12}/>,fn:()=>sendBackward(activeId),t:'Bir aşağı' },
                { icon:<ChevronUp size={12}/>,fn:()=>bringForward(activeId),t:'Bir üstə' },
                { icon:<ChevronsUp size={12}/>,fn:()=>bringToFront(activeId),t:'Ən üstə' },
              ].map((b,i)=><IBtn key={i} onClick={b.fn} title={b.t}>{b.icon}</IBtn>)}
            </div>
        )}
        <div style={{ borderRadius:8,overflow:'hidden',border:`1px solid ${C.border}` }}>
          {sorted.length===0&&<p style={{ fontSize:10,color:C.muted,textAlign:'center',padding:'12px 0' }}>Canvas boşdur</p>}
          {sorted.map((e2,idx)=>{
            const sel=selectedIds.includes(e2.id); const isH=hidden.has(e2.id)
            return (
                <div key={e2.id} draggable
                     onDragStart={ev=>{ev.dataTransfer.setData('lid',e2.id);ev.dataTransfer.effectAllowed='move'}}
                     onDragOver={ev=>{ev.preventDefault();setDragOverId(e2.id)}}
                     onDrop={ev=>{ev.preventDefault();const src=ev.dataTransfer.getData('lid');if(src&&src!==e2.id)swapZIndex(src,e2.id);setDragOverId(null)}}
                     onDragEnd={()=>setDragOverId(null)}
                     onClick={ev=>{ if(ev.shiftKey)setSelectedIds(selectedIds.includes(e2.id)?selectedIds.filter(i=>i!==e2.id):[...selectedIds,e2.id]); else setSelectedIds([e2.id]) }}
                     style={{
                       display:'flex',alignItems:'center',gap:6,padding:'5px 8px',cursor:'grab',userSelect:'none',
                       background:sel?'rgba(79,70,229,0.18)':dragOverId===e2.id?'rgba(99,102,241,0.1)':idx%2===0?'rgba(255,255,255,0.02)':'transparent',
                       borderLeft:sel?`2px solid ${C.accentB}`:'2px solid transparent',
                       borderBottom:`1px solid ${C.border}`,
                       borderTop:dragOverId===e2.id?`1px solid ${C.accentB}`:'1px solid transparent',
                     }}>
                  <span style={{ fontSize:11,width:16,textAlign:'center',flexShrink:0,color:sel?'#818cf8':C.muted }}>{TYPE_ICON[e2.type]??'▭'}</span>
                  <span style={{ fontSize:10,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isH?'#3a3a5a':sel?'#c8c8ff':'#8080a8' }}>
                {e2.type==='text'&&e2.data.text?.trim()?`"${e2.data.text.slice(0,16)}${e2.data.text.length>16?'…':''}"`:(TYPE_NAME[e2.type]??e2.type)}
              </span>
                  <button onClick={ev=>{ev.stopPropagation();toggleHide(e2.id)}}
                          style={{ background:'none',border:'none',cursor:'pointer',color:isH?C.accentB:'#3a3a5a',padding:2,display:'flex',alignItems:'center' }}
                          onMouseEnter={ev=>(ev.currentTarget as HTMLElement).style.color='#818cf8'}
                          onMouseLeave={ev=>(ev.currentTarget as HTMLElement).style.color=isH?C.accentB:'#3a3a5a'}>
                    {isH?<EyeOff size={10}/>:<Eye size={10}/>}
                  </button>
                  <button onClick={ev=>{ev.stopPropagation();setSelectedIds([e2.id]);setTimeout(()=>useCanvasStore.getState().deleteSelected(),0)}}
                          style={{ background:'none',border:'none',cursor:'pointer',color:'#3a3a5a',padding:2,display:'flex',alignItems:'center' }}
                          onMouseEnter={ev=>(ev.currentTarget as HTMLElement).style.color=C.danger}
                          onMouseLeave={ev=>(ev.currentTarget as HTMLElement).style.color='#3a3a5a'}>
                    <Trash2 size={10}/>
                  </button>
                </div>
            )
          })}
        </div>
      </div>
  )
}

function PropsContent({ el }:{ el:CanvasElement }) {
  const { updateElement } = useCanvasStore()
  const d=el.data
  const isShape=['rect','circle','triangle','diamond','pentagon','hexagon','star','parallelogram','cross','cylinder'].includes(el.type)
  const isLine=['line','arrow','freehand'].includes(el.type)
  const isText=el.type==='text'
  const isImage=el.type==='image'
  const update=(patch:Partial<ElementData>)=>updateElement(el.id,patch)
  const updateTextAll=(patch:Partial<ElementData>,runKeys:(keyof TextRun)[])=>{
    const runs=d.runs as TextRun[]|undefined
    const cleaned=runs?.map(r=>{const c:TextRun={...r};runKeys.forEach(k=>{delete (c as any)[k]});return c})
    updateElement(el.id,{...patch,...(cleaned?{runs:cleaned}:{})})
  }
  const currentDash=d.dash
  const currentStyleId=!currentDash||currentDash.length===0?'solid':currentDash[0]<=5?'dotted':'dashed'
  const sloppiness=(d as any).sloppiness??0
  const edges=(d as any).edges??'sharp'

  return (
      <div>
        <p style={{ fontSize:11,fontWeight:600,color:'#818cf8',marginBottom:12 }}>
          {TYPE_ICON[el.type]} {TYPE_NAME[el.type]??el.type}
        </p>

        {/* DOLDURMA */}
        {isShape&&(<>
          <Lbl>Doldurma</Lbl>
          <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:8 }}>
            {PRESET_FILLS.map(c=><Swatch key={c} color={c} selected={d.fill===c} onClick={()=>update({fill:c})}/>)}
          </div>
          <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:12 }}>
            <input type="color" value={d.fill==='transparent'||!d.fill?'#ffffff':d.fill} onChange={e=>update({fill:e.target.value})}
                   style={{ width:28,height:26,borderRadius:6,border:`1px solid ${C.inputBd}`,cursor:'pointer',padding:2,background:'transparent' }}/>
            <input type="text" value={d.fill||'transparent'} onChange={e=>update({fill:e.target.value})}
                   style={{ ...iSt,fontFamily:'monospace' }} placeholder="#hex"/>
          </div>
          <Div/>
        </>)}

        {/* KONTUR RƏNGİ */}
        {(isShape||isLine)&&(<>
          <Lbl>Kontur rəngi</Lbl>
          <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:8 }}>
            {PRESET_STROKES.map(c=><Swatch key={c} color={c} selected={d.stroke===c} onClick={()=>update({stroke:c})}/>)}
          </div>
          <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:12 }}>
            <input type="color" value={d.stroke==='transparent'||!d.stroke?'#000000':d.stroke} onChange={e=>update({stroke:e.target.value})}
                   style={{ width:28,height:26,borderRadius:6,border:`1px solid ${C.inputBd}`,cursor:'pointer',padding:2,background:'transparent' }}/>
            <input type="text" value={d.stroke||'#000000'} onChange={e=>update({stroke:e.target.value})}
                   style={{ ...iSt,fontFamily:'monospace' }} placeholder="#hex"/>
          </div>
          <Div/>
        </>)}

        {/* KONTUR QALINLIĞI */}
        {(isShape||isLine)&&(<>
          <Lbl>Kontur qalınlığı</Lbl>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <input type="range" min={0} max={8} step={1}
                   value={d.strokeWidth??2}
                   onChange={e=>update({strokeWidth:parseInt(e.target.value)})}
                   style={{ flex:1, accentColor:C.accentB }}/>
            <span style={{ fontSize:11, color:C.muted, width:32, textAlign:'right' }}>
            {(d.strokeWidth??2)===0?'Yox':`${d.strokeWidth??2}px`}
          </span>
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
            {STROKE_WIDTHS.map(w=>(
                <OBtn key={w} flex={false} active={(d.strokeWidth??2)===w} onClick={()=>update({strokeWidth:w})}>
                  <span style={{ fontSize:10,minWidth:22,textAlign:'center' }}>{w===0?'Yox':`${w}px`}</span>
                </OBtn>
            ))}
          </div>
          <Div/>
        </>)}

        {/* XƏTTİN TİPİ */}
        {(isShape||isLine)&&(<>
          <Lbl>Xətt tipi</Lbl>
          <div style={{ display:'flex',gap:5,marginBottom: currentStyleId!=='solid' ? 8 : 12 }}>
            {STROKE_STYLES.map(s=>(
                <OBtn key={s.id} active={currentStyleId===s.id} onClick={()=>{
                  if (!s.dash) { update({dash:undefined}); return }
                  const sw = d.strokeWidth ?? 2
                  const dash = s.id === 'dashed'
                      ? [Math.max(16, sw*5), Math.max(8, sw*3)]
                      : [1, Math.max(8, sw*4)]
                  update({dash})
                }}>{s.svg}</OBtn>
            ))}
          </div>
          {/* Aralıq slider — yalnız qırıq/nöqtəli seçiləndə */}
          {currentStyleId !== 'solid' && currentDash && (<>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>Aralıq</span>
              <input type="range" min={2} max={40} step={1}
                     value={currentDash[1] ?? 8}
                     onChange={e=>{
                       const gap = parseInt(e.target.value)
                       const newDash = currentStyleId === 'dotted'
                           ? [1, gap]
                           : [currentDash[0], gap]
                       update({dash: newDash})
                     }}
                     style={{ flex:1, accentColor:C.accentB }}/>
              <span style={{ fontSize:11, color:C.muted, width:24, textAlign:'right' }}>
              {currentDash[1] ?? 8}
            </span>
            </div>
          </>)}
          <Div/>
        </>)}

        {/* SLOPPINESS — yalnız xətt və ox üçün */}
        {isLine&&(<>
          <Lbl>Sloppiness</Lbl>
          <div style={{ display:'flex',gap:5,marginBottom:12 }}>
            {SLOPPINESS.map(s=><OBtn key={s.id} active={sloppiness===s.id} onClick={()=>update({sloppiness:s.id} as any)}>{s.svg}</OBtn>)}
          </div>
          <Div/>
        </>)}

        {/* EDGES */}
        {isShape&&(<>
          <Lbl>Edges</Lbl>
          <div style={{ display:'flex',gap:5,marginBottom:12 }}>
            {EDGES.map(eg=>(
                <OBtn key={eg.id} active={edges===eg.id} onClick={()=>update({edges:eg.id,cornerRadius:eg.id==='round'?8:0} as any)}>{eg.svg}</OBtn>
            ))}
          </div>
          <Div/>
        </>)}

        {/* KÜNC RADİUSU — cylinder istisna */}
        {isShape && el.type !== 'cylinder' &&(<>
          <Lbl>Künc radiusu</Lbl>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
            <input type="range" min={0} max={200} step={1}
                   value={Array.isArray(d.cornerRadius)?(d.cornerRadius[0]??0):(d.cornerRadius??0)}
                   onChange={e=>update({cornerRadius:parseFloat(e.target.value)} as any)}
                   style={{ flex:1,accentColor:C.accentB }}/>
            <span style={{ fontSize:11,color:C.muted,width:34,textAlign:'right' }}>
            {Array.isArray(d.cornerRadius)?(d.cornerRadius[0]??0):(d.cornerRadius??0)}px
          </span>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12 }}>
            {['Sol üst','Sağ üst','Sağ alt','Sol alt'].map((lbl,i)=>{
              const cr=Array.isArray(d.cornerRadius)?d.cornerRadius:[d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0]
              return (
                  <div key={i}>
                    <p style={{ fontSize:10,color:C.muted,marginBottom:3 }}>{lbl}</p>
                    <input type="number" min={0} max={500} value={cr[i]??0}
                           onChange={e=>{
                             const nc=[...(Array.isArray(d.cornerRadius)?d.cornerRadius:[d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0])]
                             nc[i]=parseFloat(e.target.value)||0; update({cornerRadius:nc} as any)
                           }} style={{ ...iSt,textAlign:'center' }}/>
                  </div>
              )
            })}
          </div>
          <Div/>
        </>)}

        {/* ÖLÇÜLƏR */}
        {isShape&&(<>
          <Lbl>Ölçülər</Lbl>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12 }}>
            {[{lbl:'X',k:'x'},{lbl:'Y',k:'y'},{lbl:'En',k:'width'},{lbl:'Hünd.',k:'height'}].map(({lbl,k})=>(
                <div key={k}>
                  <p style={{ fontSize:10,color:C.muted,marginBottom:4 }}>{lbl}</p>
                  <input type="number" value={Math.round((d as any)[k]??0)} onChange={e=>update({[k]:parseFloat(e.target.value)||0})} style={iSt}/>
                </div>
            ))}
          </div>
          <Div/>
        </>)}

        {/* DÖNMƏ — bütün elementlər */}
        {!isLine&&(<>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
            <Lbl>Dönmə</Lbl>
            <button onClick={()=>update({rotation:0})} style={{ fontSize:10,color:C.accentB,background:'none',border:'none',cursor:'pointer',marginBottom:6 }}>Sıfırla</button>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <input type="range" min={-180} max={180} step={1} value={d.rotation??0}
                   onChange={e=>update({rotation:parseFloat(e.target.value)})} style={{ flex:1,accentColor:C.accentB }}/>
            <span style={{ fontSize:11,color:C.muted,width:34,textAlign:'right' }}>{Math.round(d.rotation??0)}°</span>
          </div>
          <Div/>
        </>)}

        {/* ŞƏFFAFLIQ */}
        {!isImage&&(<>
          <Lbl>Şəffaflıq</Lbl>
          <input type="range" min={0} max={1} step={0.05} value={d.opacity??1}
                 onChange={e=>update({opacity:parseFloat(e.target.value)})}
                 style={{ width:'100%',accentColor:C.accentB,marginBottom:2 }}/>
          <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:C.muted,marginBottom:12 }}>
            <span>0</span><span>{Math.round((d.opacity??1)*100)}%</span><span>100</span>
          </div>
          <Div/>
        </>)}

        {/* MƏTNİN XÜSUSİYYƏTLƏRİ */}
        {isText&&(()=>{
          const fontFamily=d.fontFamily??'Arial'
          const fontSize=d.fontSize??20
          const fill=d.fill??'#0f172a'
          const bold=(d as any).fontStyle?.includes('bold')??false
          const italic=(d as any).fontStyle?.includes('italic')??false
          const underline=(d as any).textDecoration==='underline'
          const align=(d as any).align??'left'
          const letterSpace=(d as any).letterSpacing??0
          const lineH=(d as any).lineHeight??1.2
          const toggleBold=()=>{
            const cur=(d as any).fontStyle??'normal'
            updateTextAll({fontStyle:bold?cur.replace('bold','').trim()||'normal':cur==='normal'?'bold':cur+' bold'} as any,['fontStyle'])
          }
          const toggleItalic=()=>{
            const cur=(d as any).fontStyle??'normal'
            updateTextAll({fontStyle:italic?cur.replace('italic','').trim()||'normal':cur==='normal'?'italic':cur+' italic'} as any,['fontStyle'])
          }
          const FONTS=['Arial','Arial Black','Comic Sans MS','Courier New','Georgia','Impact','Times New Roman','Trebuchet MS','Verdana','Helvetica','Tahoma']
          return (<>
            <Lbl>Font</Lbl>
            <select value={fontFamily} onChange={e=>updateTextAll({fontFamily:e.target.value},['fontFamily'])}
                    style={{ ...iSt,fontFamily,appearance:'none',cursor:'pointer',marginBottom:12 }}>
              {FONTS.map(f=><option key={f} value={f} style={{ fontFamily:f,background:'#1e1e2e',color:C.text }}>{f}</option>)}
            </select>
            <Div/>
            <Lbl>Stil</Lbl>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
              <input type="number" value={fontSize} min={6} max={400}
                     onChange={e=>updateTextAll({fontSize:parseInt(e.target.value)||20},['fontSize'])}
                     style={{ ...iSt,width:54,textAlign:'center' }}/>
              <span style={{ fontSize:10,color:C.muted }}>px</span>
              <div style={{ flex:1 }}/>
              {[
                {lbl:'B',active:bold,onClick:toggleBold,extra:{fontWeight:700}},
                {lbl:'I',active:italic,onClick:toggleItalic,extra:{fontStyle:'italic' as const}},
                {lbl:'U',active:underline,onClick:()=>updateTextAll({textDecoration:underline?'none':'underline'} as any,['textDecoration']),extra:{textDecoration:'underline' as const}},
              ].map(({lbl,active,onClick,extra})=>(
                  <button key={lbl} onClick={onClick}
                          style={{ width:28,height:28,borderRadius:7,fontSize:13,cursor:'pointer',
                            border:active?`1px solid ${C.accentB}`:`1px solid ${C.border}`,
                            background:active?C.accentL:C.input,color:active?'#a5b4fc':C.muted,...extra }}>
                    {lbl}
                  </button>
              ))}
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:3,marginBottom:12 }}>
              {[10,12,14,16,18,20,24,28,32,36,48,64].map(s=>(
                  <OBtn key={s} flex={false} active={fontSize===s} onClick={()=>updateTextAll({fontSize:s},['fontSize'])}>
                    <span style={{ fontSize:10,minWidth:16,textAlign:'center' }}>{s}</span>
                  </OBtn>
              ))}
            </div>
            <Div/>
            <Lbl>Hizalama</Lbl>
            <div style={{ display:'flex',gap:4,marginBottom:12 }}>
              {([
                { v:'left' as const,   svg:<svg width="20" height="16" viewBox="0 0 20 16"><line x1="2" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
                { v:'center' as const, svg:<svg width="20" height="16" viewBox="0 0 20 16"><line x1="2" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
                { v:'right' as const,  svg:<svg width="20" height="16" viewBox="0 0 20 16"><line x1="2" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="4" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
              ]).map(({v,svg})=>(
                  <OBtn key={v} active={align===v} onClick={()=>update({align:v} as any)}>{svg}</OBtn>
              ))}
            </div>
            <Div/>
            <Lbl>Aralıqlar</Lbl>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12 }}>
              <div>
                <p style={{ fontSize:10,color:C.muted,marginBottom:4 }}>Hərf aralığı</p>
                <input type="number" value={letterSpace} min={-20} max={200} step={0.5}
                       onChange={e=>update({letterSpacing:parseFloat(e.target.value)||0} as any)}
                       style={{ ...iSt,textAlign:'center',marginBottom:4 }}/>
                <input type="range" min={-20} max={200} step={0.5} value={letterSpace}
                       onChange={e=>update({letterSpacing:parseFloat(e.target.value)} as any)}
                       style={{ width:'100%',accentColor:C.accentB }}/>
              </div>
              <div>
                <p style={{ fontSize:10,color:C.muted,marginBottom:4 }}>Sətir aralığı</p>
                <input type="number" value={lineH} min={0.5} max={5} step={0.05}
                       onChange={e=>update({lineHeight:parseFloat(e.target.value)||1.2} as any)}
                       style={{ ...iSt,textAlign:'center',marginBottom:4 }}/>
                <input type="range" min={0.5} max={5} step={0.05} value={lineH}
                       onChange={e=>update({lineHeight:parseFloat(e.target.value)} as any)}
                       style={{ width:'100%',accentColor:C.accentB }}/>
              </div>
            </div>
            <Div/>
            <Lbl>Mətn rəngi</Lbl>
            <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:8 }}>
              {PRESET_STROKES.map(c=><Swatch key={c} color={c} selected={fill===c} onClick={()=>updateTextAll({fill:c},['fill'])}/>)}
            </div>
            <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:12 }}>
              <input type="color" value={fill==='transparent'||!fill?'#000000':fill}
                     onChange={e=>updateTextAll({fill:e.target.value},['fill'])}
                     style={{ width:28,height:26,borderRadius:6,border:`1px solid ${C.inputBd}`,cursor:'pointer',padding:2,background:'transparent' }}/>
              <input type="text" value={fill||'#000000'} onChange={e=>updateTextAll({fill:e.target.value},['fill'])}
                     style={{ ...iSt,fontFamily:'monospace' }}/>
            </div>
            <Div/>
            <Lbl>Mətn qutusu</Lbl>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8 }}>
              {[{lbl:'X',k:'x'},{lbl:'Y',k:'y'},...((d as any).autoWidth===false?[{lbl:'En',k:'width'},{lbl:'Hünd.',k:'height'}]:[])].map(({lbl,k})=>(
                  <div key={k}>
                    <p style={{ fontSize:10,color:C.muted,marginBottom:4 }}>{lbl}</p>
                    <input type="number" value={Math.round((d as any)[k]??0)} onChange={e=>update({[k]:parseFloat(e.target.value)||0})} style={iSt}/>
                  </div>
              ))}
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
              <p style={{ fontSize:10,color:C.muted }}>Qutu ölçüsü</p>
            </div>
            <p style={{ fontSize:10,color:'#3a3a5a',lineHeight:1.6,marginTop:8 }}>
              Bir hissəni dəyişmək üçün mətnə iki dəfə klikləyin.
            </p>
          </>)
        })()}
      </div>
  )
}

export default function LeftPanel() {
  const [open,setOpen]=useState(false)
  const { elements,selectedIds } = useCanvasStore()
  const el=selectedIds.length===1?elements.find(e=>e.id===selectedIds[0]):null

  // Element seçiləndə paneli avtomatik aç
  const prevSelectedRef = useRef<string[]>([])
  useEffect(()=>{
    if(selectedIds.length > 0 && prevSelectedRef.current.length === 0){
      setOpen(true)
    }
    prevSelectedRef.current = selectedIds
  }, [selectedIds])

  return (
      <>
        <div style={{ position:'absolute',left:12,top:12,zIndex:40 }}>
          <button onClick={()=>setOpen(v=>!v)} title="Panel"
                  style={{
                    width:36,height:36,borderRadius:10,
                    background:open?C.accent:C.bg,
                    border:`1px solid ${open?C.accentB:C.border}`,
                    cursor:'pointer',display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'center',gap:4,
                    boxShadow:'0 4px 16px rgba(0,0,0,0.4)',transition:'all 0.15s',
                  }}>
            {[0,1,2].map(i=>(
                <span key={i} style={{ width:15,height:1.5,borderRadius:2,background:open?'#fff':C.muted,transition:'background 0.15s' }}/>
            ))}
          </button>
        </div>

        {open&&(
            <div style={{
              position:'absolute',left:56,top:12,zIndex:35,
              width:232,maxHeight:'calc(100vh - 80px)',
              background:C.bg,border:`1px solid ${C.border}`,borderRadius:14,
              boxShadow:'0 8px 40px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.04) inset',
              overflowY:'auto',overflowX:'hidden',
            }}>
              <div style={{ padding:'14px 14px 20px' }}>
                {el?(<><PropsContent el={el}/><Div/></>):(
                    <p style={{ fontSize:11,color:C.muted,marginBottom:14,lineHeight:1.6 }}>
                      Element seçin —<br/>xüsusiyyətlər burada görünəcək
                    </p>
                )}
                <Lbl>Layers</Lbl>
                <LayerList/>
              </div>
            </div>
        )}
      </>
  )
}