"use strict";(()=>{var e={};e.id=7446,e.ids=[7446],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},20629:e=>{e.exports=require("fs/promises")},55315:e=>{e.exports=require("path")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},88498:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{originalPathname:()=>m,patchFetch:()=>u,requestAsyncStorage:()=>y,routeModule:()=>l,serverHooks:()=>p,staticGenerationAsyncStorage:()=>c});var n=a(49303),r=a(88716),s=a(60670),o=a(807),d=e([o]);o=(d.then?(await d)():d)[0];let l=new n.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/meeting-notes/[id]/route",pathname:"/api/meeting-notes/[id]",filename:"route",bundlePath:"app/api/meeting-notes/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\meeting-notes\\[id]\\route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:y,staticGenerationAsyncStorage:c,serverHooks:p}=l,m="/api/meeting-notes/[id]/route";function u(){return(0,s.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:c})}i()}catch(e){i(e)}})},807:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{DELETE:()=>g,GET:()=>E,PATCH:()=>f});var n=a(84770),r=a(87070),s=a(91585),o=a(75748),d=a(14123),u=a(37014),l=a(95698),y=a(49185),c=a(91978),p=a(61165),m=e([o,d,u,y,c]);[o,d,u,y,c]=m.then?(await m)():m;let w=s.Ry({id:s.Z_().uuid().optional(),text:s.Z_(),checked:s.O7()}),R=s.VK("type",[s.Ry({type:s.i0("heading"),body:s.Z_()}),s.Ry({type:s.i0("paragraph"),body:s.Z_()}),s.Ry({type:s.i0("divider")}),s.Ry({type:s.i0("checklist"),items:s.IX(w)})]),N=s.Ry({title:s.Z_().max(500).optional(),attendeeUserIds:s.IX(s.Z_().uuid()).max(100).optional(),blocks:s.IX(R).optional()});async function _(e){let t=(await o.db.query(`
    SELECT
      n.id::text,
      n.title,
      n.department_id::text,
      d.name AS department_name,
      n.created_by::text,
      n.created_at,
      n.updated_at
    FROM meeting_notes n
    INNER JOIN departments d ON d.id = n.department_id
    WHERE n.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let a=(await o.db.query("SELECT user_id::text FROM meeting_note_attendees WHERE note_id = $1::uuid",[e])).rows.map(e=>e.user_id),i=(await o.db.query(a.length?"SELECT id::text, name, email FROM users WHERE id = ANY($1::uuid[])":"SELECT id::text, name, email FROM users WHERE FALSE",a.length?[a]:[])).rows.map(e=>({id:e.id,name:e.name,email:e.email})),n=(await o.db.query(`
    SELECT
      id::text,
      sort_order,
      block_type,
      body,
      checklist_items
    FROM note_blocks
    WHERE note_id = $1::uuid
    ORDER BY sort_order ASC, created_at ASC
    `,[e])).rows.map(e=>{let t={id:e.id,sortOrder:e.sort_order,type:e.block_type};if("checklist"===e.block_type){let a=Array.isArray(e.checklist_items)?e.checklist_items:[];return{...t,type:"checklist",body:null,checklistItems:a}}return"divider"===e.block_type?{...t,type:"divider",body:null,checklistItems:null}:{...t,type:e.block_type,body:e.body,checklistItems:null}});return{id:t.id,title:t.title,departmentId:t.department_id,departmentName:t.department_name,attendeeUserIds:a,attendees:i,blocks:n,createdBy:t.created_by,createdAt:t.created_at.toISOString(),updatedAt:t.updated_at.toISOString()}}async function E(e,t){let a=(0,p.v6)(e);if(!a)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,c.r)(a.sub);if(!i)return r.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:n}=t.params,s=await (0,y.G)(n);if(!s)return r.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,y.q)(i,s))return r.NextResponse.json({message:"접근할 수 없습니다."},{status:403});let o=await _(n);return o?r.NextResponse.json({note:o}):r.NextResponse.json({message:"찾을 수 없습니다."},{status:404})}async function f(e,t){let a;let i=(0,p.v6)(e);if(!i)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let s=await (0,c.r)(i.sub);if(!s)return r.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:u}=t.params,l=await (0,y.G)(u);if(!l)return r.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,y.q)(s,l))return r.NextResponse.json({message:"접근할 수 없습니다."},{status:403});try{a=await e.json()}catch{return r.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let m=N.safeParse(a);if(!m.success)return r.NextResponse.json({message:"입력값이 올바르지 않습니다."},{status:400});let{title:E,attendeeUserIds:f,blocks:g}=m.data,w=await o.db.connect();try{if(await w.query("BEGIN"),null!=E&&await w.query("UPDATE meeting_notes SET title = $1, updated_at = NOW() WHERE id = $2::uuid",[E,u]),null!=f)for(let e of(await w.query("DELETE FROM meeting_note_attendees WHERE note_id = $1::uuid",[u]),Array.from(new Set([i.sub,...f]))))await w.query(`
          INSERT INTO meeting_note_attendees (note_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (note_id, user_id) DO NOTHING
          `,[u,e]);if(null!=g){await w.query("DELETE FROM note_blocks WHERE note_id = $1::uuid",[u]);let e=0;for(let t of g){if("divider"===t.type)await w.query(`
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'divider', NULL, NULL)
            `,[u,e]);else if("heading"===t.type)await w.query(`
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'heading', $3, NULL)
            `,[u,e,t.body]);else if("paragraph"===t.type)await w.query(`
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'paragraph', $3, NULL)
            `,[u,e,t.body]);else if("checklist"===t.type){let a=t.items.map(e=>({id:e.id??(0,n.randomUUID)(),text:e.text,checked:e.checked}));await w.query(`
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'checklist', NULL, $3::jsonb)
            `,[u,e,JSON.stringify(a)])}e+=1}}await w.query("UPDATE meeting_notes SET updated_at = NOW() WHERE id = $1::uuid",[u]),await w.query("COMMIT")}catch(e){return await w.query("ROLLBACK"),console.error("[PATCH meeting-notes]",e),r.NextResponse.json({message:"저장하지 못했습니다."},{status:500})}finally{w.release()}let R=await _(u);return R&&await (0,d.v)({userId:i.sub,actionType:"note_updated",entityType:"note",entityId:u,entityName:R.title||"제목 없음",departmentId:R.departmentId,metadata:{url:`/meeting-notes?id=${encodeURIComponent(u)}`}}),r.NextResponse.json({note:R})}async function g(e,t){let a=(0,p.v6)(e);if(!a)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,c.r)(a.sub);if(!i)return r.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:n}=t.params,s=await (0,y.G)(n);if(!s)return r.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,y.q)(i,s))return r.NextResponse.json({message:"접근할 수 없습니다."},{status:403});for(let e of(await (0,u.fA)("meeting_note",n)))await (0,l.Yy)(e.storage_key);return await o.db.query("DELETE FROM meeting_notes WHERE id = $1::uuid",[n]),r.NextResponse.json({ok:!0})}i()}catch(e){i(e)}})},14123:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{v:()=>d});var n=a(75748),r=a(20940),s=e([n]);async function o(e){let{userId:t,actionType:a,entityType:i,entityId:s,entityName:o,departmentId:d=null,metadata:u={}}=e,l=await n.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[t,a,i,s,o,d,JSON.stringify(u)]);(0,r.yS)("activity:new",{id:l.rows[0]?.id??null})}async function d(e){try{await o(e)}catch(e){console.error("[activity-log]",e)}}n=(s.then?(await s)():s)[0],i()}catch(e){i(e)}})},20940:(e,t,a)=>{function i(e,t){let a=globalThis.__activityIoBroadcast;try{a?.(e,t)}catch{}}function n(){i("nav:badges",{})}function r(e){i("chat:notify",e)}a.d(t,{CK:()=>r,h0:()=>n,yS:()=>i})},1923:(e,t,a)=>{a.d(t,{S:()=>n,l:()=>i});let i="auth_token",n="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{db:()=>s});var n=a(8678),r=e([n]);n=(r.then?(await r)():r)[0];let s=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});i()}catch(e){i(e)}})},37014:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Gd:()=>o,Gf:()=>y,cB:()=>c,ev:()=>d,fA:()=>p,yg:()=>u,zx:()=>l});var n=a(75748),r=a(65465),s=e([n,r]);function o(e){let t=e.mime_type.startsWith("image/"),a=(0,r.K5)(e);return{id:e.id,originalName:e.original_name,mimeType:e.mime_type,byteSize:Number(e.byte_size),url:`/api/files/${e.id}`,previewUrl:t&&!a?`/api/files/${e.id}?inline=1`:null,isImage:t,expired:!!a||void 0}}async function d(e,t){return(await n.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    ORDER BY created_at ASC
    `,[e,t])).rows.map(o)}async function u(e){let t=new Map;if(0===e.length)return t;for(let a of(await n.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = 'chat_message' AND entity_id = ANY($1::uuid[])
    ORDER BY created_at ASC
    `,[e])).rows){let e=a.entity_id,i=o(a),n=t.get(e)??[];n.push(i),t.set(e,n)}return t}async function l(e){return(await n.db.query(`
    INSERT INTO file_attachments (
      entity_type, entity_id, uploaded_by, original_name, storage_key, mime_type, byte_size
    )
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7)
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e.entityType,e.entityId,e.uploadedBy,e.originalName,e.storageKey,e.mimeType,e.byteSize])).rows[0]}async function y(e){return(await n.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE id = $1::uuid
    LIMIT 1
    `,[e])).rows[0]??null}async function c(e){return(await n.db.query(`
    DELETE FROM file_attachments
    WHERE id = $1::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e])).rows[0]??null}async function p(e,t){return(await n.db.query(`
    DELETE FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e,t])).rows}[n,r]=s.then?(await s)():s,i()}catch(e){i(e)}})},65465:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Hw:()=>u,K5:()=>d});var n=a(75748),r=a(95698),s=e([n]);function o(){let e=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(e)&&e>0?e:30}function d(e){var t;if(t=e.entity_type,"chat_message"!==t&&"task"!==t)return!1;let a=o(),i=new Date(e.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function u(){let e=o(),t=await n.db.connect(),a=0,i=[];try{await t.query("BEGIN");let n=await t.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[e]);if(0===n.rows.length)return await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await t.query("COMMIT"),{filesDeleted:0};let r=n.rows.map(e=>e.id),s=await t.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[r]);for(let e of(a=s.rows.length,s.rows))i.push(e.storage_key);await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await t.query("COMMIT")}catch(e){try{await t.query("ROLLBACK")}catch{}throw e}finally{t.release()}return await Promise.all(i.map(e=>(0,r.Yy)(e))),{filesDeleted:a}}n=(s.then?(await s)():s)[0],i()}catch(e){i(e)}})},95698:(e,t,a)=>{a.d(t,{D0:()=>c,Yy:()=>p,fu:()=>m,q5:()=>y});var i=a(84770),n=a(20629),r=a.n(n),s=a(55315),o=a.n(s);let d=o().join(process.cwd(),"storage","uploads"),u=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),l={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function y(e){let t=o().basename(e),a=t.lastIndexOf(".");return -1===a?"":t.slice(a+1).toLowerCase()}async function c(e,t){let a=y(t);if(!a||!u.has(a))throw Error("unsupported_type");if(e.length>26214400)throw Error("too_large");let n=l[a.toLowerCase()]??"application/octet-stream",s=new Date,c=o().join(String(s.getFullYear()),String(s.getMonth()+1).padStart(2,"0")),p=o().join(d,c);await r().mkdir(p,{recursive:!0});let m=o().basename(t).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),_=`${(0,i.randomUUID)()}_${m||`file.${a}`}`,E=o().join(p,_);return await r().writeFile(E,e),{storageKey:o().join(c,_).replace(/\\/g,"/"),mimeType:n,byteSize:e.length}}async function p(e){let t=o().join(d,e),a=o().normalize(t);if(!a.startsWith(o().normalize(d)))throw Error("invalid_path");await r().unlink(a).catch(()=>void 0)}function m(e){return o().join(d,e)}},49185:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{G:()=>d,q:()=>o});var n=a(75748),r=a(27754),s=e([n,r]);async function o(e,t){return"admin"===e.role||(await (0,r.J)(e)).includes(t)}async function d(e){let t=await n.db.query("SELECT department_id::text FROM meeting_notes WHERE id = $1::uuid",[e]);return t.rows[0]?.department_id??null}[n,r]=s.then?(await s)():s,i()}catch(e){i(e)}})},27754:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{J:()=>s,d:()=>o});var n=a(75748),r=e([n]);async function s(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let a=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),i=new Set(t);if(0===a.length)return[...i];for(let e of(await n.db.query(`
    WITH RECURSIVE sub AS (
      SELECT id
      FROM departments
      WHERE id = ANY($1::uuid[])
      UNION ALL
      SELECT d.id
      FROM departments d
      INNER JOIN sub ON d.parent_id = sub.id
    )
    SELECT DISTINCT id::text FROM sub
    `,[a])).rows)i.add(e.id);return[...i]}async function o(e,t){return"admin"===e.role||!!t&&(await s(e)).includes(t)}n=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})},61165:(e,t,a)=>{a.d(t,{v6:()=>s});var i=a(41482),n=a.n(i),r=a(1923);function s(e){let t=e.cookies.get(r.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{r:()=>o});var n=a(75748),r=a(74034),s=e([n,r]);async function o(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let a=await (0,r.Z)(e),i=a.find(e=>e.isPrimary)??a[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:i?.departmentId??null,departmentName:i?.departmentName??null,departments:a.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,r]=s.then?(await s)():s,i()}catch(e){i(e)}})},74034:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Z:()=>s});var n=a(75748),r=e([n]);async function s(e){return(await n.db.query(`
    SELECT
      ud.id::text,
      ud.user_id::text,
      ud.department_id::text,
      d.name AS department_name,
      ud.is_primary,
      ud.role
    FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = $1::uuid
    ORDER BY ud.is_primary DESC, d.name ASC
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[9276,5972,1482,1585],()=>a(88498));module.exports=i})();