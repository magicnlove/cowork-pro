"use strict";(()=>{var e={};e.id=7148,e.ids=[7148],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},44451:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var i=r(49303),n=r(88716),d=r(60670),u=r(94663),s=e([u]);u=(s.then?(await s)():s)[0];let p=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/activity/[id]/route",pathname:"/api/activity/[id]",filename:"route",bundlePath:"app/api/activity/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\activity\\[id]\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:c}=p,y="/api/activity/[id]/route";function o(){return(0,d.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}a()}catch(e){a(e)}})},94663:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{DELETE:()=>p});var i=r(87070),n=r(36648),d=r(75748),u=r(61165),s=r(91978),o=e([n,d,s]);async function p(e,t){let r=(0,u.v6)(e);if(!r)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,s.r)(r.sub);if(!a)return i.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:o}=t.params,p=(await d.db.query(`
    SELECT user_id::text, department_id::text
    FROM activity_logs
    WHERE id = $1::uuid
    LIMIT 1
    `,[o])).rows[0];return p&&await (0,n.e)(a,{user_id:p.user_id,department_id:p.department_id})?(0,n.G)(a,p.user_id)?(await d.db.query("DELETE FROM activity_logs WHERE id = $1::uuid",[o]),i.NextResponse.json({ok:!0})):i.NextResponse.json({message:"삭제할 권한이 없습니다."},{status:403}):i.NextResponse.json({message:"찾을 수 없습니다."},{status:404})}[n,d,s]=o.then?(await o)():o,a()}catch(e){a(e)}})},36648:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{G:()=>u,e:()=>d});var i=r(27754),n=e([i]);async function d(e,t){if("admin"===e.role)return!0;let r=await (0,i.J)(e);return!!(t.department_id&&r.includes(t.department_id))||!t.department_id&&t.user_id===e.id}function u(e,t){return"admin"===e.role||e.id===t}i=(n.then?(await n)():n)[0],a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>i,l:()=>a});let a="auth_token",i="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var i=r(8678),n=e([i]);i=(n.then?(await n)():n)[0];let d=global.__pgPool??new i.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>d,d:()=>u});var i=r(75748),n=e([i]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await i.db.query(`
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
    `,[r])).rows)a.add(e.id);return[...a]}async function u(e,t){return"admin"===e.role||!!t&&(await d(e)).includes(t)}i=(n.then?(await n)():n)[0],a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var a=r(41482),i=r.n(a),n=r(1923);function d(e){let t=e.cookies.get(n.l)?.value;return t?function(e){try{let t=i().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var i=r(75748),n=r(74034),d=e([i,n]);async function u(e){if(!e||"undefined"===e)return null;let t=(await i.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,n.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[i,n]=d.then?(await d)():d,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>d});var i=r(75748),n=e([i]);async function d(e){return(await i.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}i=(n.then?(await n)():n)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(44451));module.exports=a})();