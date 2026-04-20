"use strict";(()=>{var e={};e.id=1285,e.ids=[1285],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},65368:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>m,staticGenerationAsyncStorage:()=>c});var n=r(49303),i=r(88716),d=r(60670),s=r(46521),u=e([s]);s=(u.then?(await u)():u)[0];let p=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/tasks/[id]/read/route",pathname:"/api/tasks/[id]/read",filename:"route",bundlePath:"app/api/tasks/[id]/read/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\tasks\\[id]\\read\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:m}=p,y="/api/tasks/[id]/read/route";function o(){return(0,d.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:c})}a()}catch(e){a(e)}})},46521:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>l});var n=r(87070),i=r(20940),d=r(75748),s=r(45043),u=r(61165),o=r(91978),p=e([d,s,o]);async function l(e,t){let r=(0,u.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,o.r)(r.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:p}=t.params,l=(await d.db.query(`
    SELECT department_id::text, created_by::text
    FROM tasks
    WHERE id = $1::uuid
    LIMIT 1
    `,[p])).rows[0];return l?await (0,s.c)(a,{departmentId:l.department_id,createdBy:l.created_by})?(await d.db.query(`
    INSERT INTO user_task_reads (user_id, task_id, read_at)
    VALUES ($1::uuid, $2::uuid, NOW())
    ON CONFLICT (user_id, task_id)
    DO UPDATE SET read_at = EXCLUDED.read_at
    `,[r.sub,p]),(0,i.h0)(),n.NextResponse.json({ok:!0})):n.NextResponse.json({message:"접근 권한이 없습니다."},{status:403}):n.NextResponse.json({message:"찾을 수 없습니다."},{status:404})}[d,s,o]=p.then?(await p)():p,a()}catch(e){a(e)}})},20940:(e,t,r)=>{function a(e,t){let r=globalThis.__activityIoBroadcast;try{r?.(e,t)}catch{}}function n(){a("nav:badges",{})}function i(e){a("chat:notify",e)}r.d(t,{CK:()=>i,h0:()=>n,yS:()=>a})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>d,d:()=>s});var n=r(75748),i=e([n]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await n.db.query(`
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
    `,[r])).rows)a.add(e.id);return[...a]}async function s(e,t){return"admin"===e.role||!!t&&(await d(e)).includes(t)}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var a=r(41482),n=r.n(a),i=r(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},45043:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{c:()=>d});var n=r(27754),i=e([n]);async function d(e,t){return"admin"===e.role||(t.departmentId?(await (0,n.J)(e)).includes(t.departmentId):t.createdBy===e.id)}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>s});var n=r(75748),i=r(74034),d=e([n,i]);async function s(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})}};var t=require("../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(65368));module.exports=a})();