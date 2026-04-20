"use strict";(()=>{var e={};e.id=9923,e.ids=[9923],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},78396:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>u,requestAsyncStorage:()=>p,routeModule:()=>l,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var n=r(49303),i=r(88716),d=r(60670),s=r(71177),o=e([s]);s=(o.then?(await o)():o)[0];let l=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/meeting-notes/route",pathname:"/api/meeting-notes",filename:"route",bundlePath:"app/api/meeting-notes/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\meeting-notes\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:c}=l,y="/api/meeting-notes/route";function u(){return(0,d.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}a()}catch(e){a(e)}})},71177:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>y,POST:()=>_});var n=r(84770),i=r(87070),d=r(91585),s=r(75748),o=r(14123),u=r(49185),l=r(27754),p=r(61165),m=r(91978),c=e([s,o,u,l,m]);[s,o,u,l,m]=c.then?(await c)():c;let N=d.Ry({id:d.Z_().uuid().optional(),text:d.Z_(),checked:d.O7()}),E=d.VK("type",[d.Ry({type:d.i0("heading"),body:d.Z_()}),d.Ry({type:d.i0("paragraph"),body:d.Z_()}),d.Ry({type:d.i0("divider")}),d.Ry({type:d.i0("checklist"),items:d.IX(N)})]),f=d.Ry({title:d.Z_().max(500).optional().default(""),departmentId:d.Z_().uuid(),attendeeUserIds:d.IX(d.Z_().uuid()).max(100).optional().default([]),blocks:d.IX(E).optional().default([])});async function y(e){let t=(0,p.v6)(e);if(!t)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,m.r)(t.sub);if(!r)return i.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});if("admin"===r.role){let e=(await s.db.query(`
      SELECT
        n.id::text,
        n.title,
        n.department_id::text,
        d.name AS department_name,
        n.updated_at,
        n.created_at
      FROM meeting_notes n
      INNER JOIN departments d ON d.id = n.department_id
      ORDER BY n.sort_order ASC, n.updated_at DESC
      LIMIT 200
      `)).rows.map(e=>({id:e.id,title:e.title,departmentId:e.department_id,departmentName:e.department_name,updatedAt:e.updated_at.toISOString(),createdAt:e.created_at.toISOString()}));return i.NextResponse.json({notes:e})}let a=await (0,l.J)(r);if(0===a.length)return i.NextResponse.json({notes:[]});let n=(await s.db.query(`
    SELECT
      n.id::text,
      n.title,
      n.department_id::text,
      d.name AS department_name,
      n.updated_at,
      n.created_at
    FROM meeting_notes n
    INNER JOIN departments d ON d.id = n.department_id
    WHERE n.department_id = ANY($1::uuid[])
    ORDER BY n.sort_order ASC, n.updated_at DESC
    LIMIT 200
    `,[a])).rows.map(e=>({id:e.id,title:e.title,departmentId:e.department_id,departmentName:e.department_name,updatedAt:e.updated_at.toISOString(),createdAt:e.created_at.toISOString()}));return i.NextResponse.json({notes:n})}async function _(e){let t;let r=(0,p.v6)(e);if(!r)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,m.r)(r.sub);if(!a)return i.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});try{t=await e.json()}catch{return i.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let d=f.safeParse(t);if(!d.success)return i.NextResponse.json({message:"입력값이 올바르지 않습니다."},{status:400});let{title:l,departmentId:c,attendeeUserIds:y,blocks:_}=d.data;if(!await (0,u.q)(a,c))return i.NextResponse.json({message:"이 부서에 노트를 만들 권한이 없습니다."},{status:403});let N=await s.db.connect();try{await N.query("BEGIN");let e=await N.query(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM meeting_notes
      WHERE department_id = $1::uuid
      `,[c]),t=Number(e.rows[0]?.next_order??0),a=(await N.query(`
      INSERT INTO meeting_notes (department_id, title, sort_order, created_by)
      VALUES ($1::uuid, $2, $3, $4::uuid)
      RETURNING id::text
      `,[c,l.trim()||"제목 없음",t,r.sub])).rows[0].id;for(let e of Array.from(new Set([r.sub,...y])))await N.query(`
        INSERT INTO meeting_note_attendees (note_id, user_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT (note_id, user_id) DO NOTHING
        `,[a,e]);let d=0;for(let e of _){if("divider"===e.type)await N.query(`
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'divider', NULL, NULL)
          `,[a,d]);else if("heading"===e.type)await N.query(`
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'heading', $3, NULL)
          `,[a,d,e.body]);else if("paragraph"===e.type)await N.query(`
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'paragraph', $3, NULL)
          `,[a,d,e.body]);else if("checklist"===e.type){let t=e.items.map(e=>({id:e.id??(0,n.randomUUID)(),text:e.text,checked:e.checked}));await N.query(`
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'checklist', NULL, $3::jsonb)
          `,[a,d,JSON.stringify(t)])}d+=1}return await N.query("COMMIT"),await (0,o.v)({userId:r.sub,actionType:"note_created",entityType:"note",entityId:a,entityName:l.trim()||"제목 없음",departmentId:c,metadata:{url:`/meeting-notes?id=${encodeURIComponent(a)}`}}),i.NextResponse.json({id:a})}catch(e){return await N.query("ROLLBACK"),console.error("[POST meeting-notes]",e),i.NextResponse.json({message:"저장하지 못했습니다."},{status:500})}finally{N.release()}}a()}catch(e){a(e)}})},14123:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{v:()=>o});var n=r(75748),i=r(20940),d=e([n]);async function s(e){let{userId:t,actionType:r,entityType:a,entityId:d,entityName:s,departmentId:o=null,metadata:u={}}=e,l=await n.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[t,r,a,d,s,o,JSON.stringify(u)]);(0,i.yS)("activity:new",{id:l.rows[0]?.id??null})}async function o(e){try{await s(e)}catch(e){console.error("[activity-log]",e)}}n=(d.then?(await d)():d)[0],a()}catch(e){a(e)}})},20940:(e,t,r)=>{function a(e,t){let r=globalThis.__activityIoBroadcast;try{r?.(e,t)}catch{}}function n(){a("nav:badges",{})}function i(e){a("chat:notify",e)}r.d(t,{CK:()=>i,h0:()=>n,yS:()=>a})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},49185:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{G:()=>o,q:()=>s});var n=r(75748),i=r(27754),d=e([n,i]);async function s(e,t){return"admin"===e.role||(await (0,i.J)(e)).includes(t)}async function o(e){let t=await n.db.query("SELECT department_id::text FROM meeting_notes WHERE id = $1::uuid",[e]);return t.rows[0]?.department_id??null}[n,i]=d.then?(await d)():d,a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>d,d:()=>s});var n=r(75748),i=e([n]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await n.db.query(`
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
    `,[r])).rows)a.add(e.id);return[...a]}async function s(e,t){return"admin"===e.role||!!t&&(await d(e)).includes(t)}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var a=r(41482),n=r.n(a),i=r(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>s});var n=r(75748),i=r(74034),d=e([n,i]);async function s(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,i.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,i]=d.then?(await d)():d,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>d});var n=r(75748),i=e([n]);async function d(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>r(78396));module.exports=a})();