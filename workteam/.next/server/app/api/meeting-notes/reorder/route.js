"use strict";(()=>{var e={};e.id=2383,e.ids=[2383],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},17867:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>m,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p});var a=r(49303),s=r(88716),i=r(60670),u=r(43536),d=e([u]);u=(d.then?(await d)():d)[0];let m=new a.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/meeting-notes/reorder/route",pathname:"/api/meeting-notes/reorder",filename:"route",bundlePath:"app/api/meeting-notes/reorder/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\meeting-notes\\reorder\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:c}=m,y="/api/meeting-notes/reorder/route";function o(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}n()}catch(e){n(e)}})},43536:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{PATCH:()=>l});var a=r(87070),s=r(91585),i=r(75748),u=r(49185),d=r(61165),o=r(91978),m=e([i,u,o]);[i,u,o]=m.then?(await m)():m;let p=s.Ry({orderedNoteIds:s.IX(s.Z_().uuid()).min(1)});async function l(e){let t;let r=(0,d.v6)(e);if(!r)return a.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let n=await (0,o.r)(r.sub);if(!n)return a.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});try{t=await e.json()}catch{return a.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let s=p.safeParse(t);if(!s.success)return a.NextResponse.json({message:"입력값이 올바르지 않습니다."},{status:400});let m=s.data.orderedNoteIds,l=await i.db.query(`
    SELECT id::text, department_id::text
    FROM meeting_notes
    WHERE id = ANY($1::uuid[])
    `,[m]);if(l.rowCount!==m.length)return a.NextResponse.json({message:"일부 노트를 찾을 수 없습니다."},{status:404});let c=l.rows[0]?.department_id;if(!c)return a.NextResponse.json({message:"부서 정보가 없습니다."},{status:400});if(l.rows.some(e=>e.department_id!==c))return a.NextResponse.json({message:"같은 부서 노트만 정렬할 수 있습니다."},{status:400});if(!await (0,u.q)(n,c))return a.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});let y=await i.db.connect();try{await y.query("BEGIN");for(let e=0;e<m.length;e+=1)await y.query("UPDATE meeting_notes SET sort_order = $1, updated_at = updated_at WHERE id = $2::uuid",[e,m[e]]);await y.query("COMMIT")}catch(e){return await y.query("ROLLBACK"),console.error("[PATCH meeting-notes/reorder]",e),a.NextResponse.json({message:"정렬을 저장하지 못했습니다."},{status:500})}finally{y.release()}return a.NextResponse.json({ok:!0})}n()}catch(e){n(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>a,l:()=>n});let n="auth_token",a="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{db:()=>i});var a=r(8678),s=e([a]);a=(s.then?(await s)():s)[0];let i=global.__pgPool??new a.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},49185:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{G:()=>d,q:()=>u});var a=r(75748),s=r(27754),i=e([a,s]);async function u(e,t){return"admin"===e.role||(await (0,s.J)(e)).includes(t)}async function d(e){let t=await a.db.query("SELECT department_id::text FROM meeting_notes WHERE id = $1::uuid",[e]);return t.rows[0]?.department_id??null}[a,s]=i.then?(await i)():i,n()}catch(e){n(e)}})},27754:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{J:()=>i,d:()=>u});var a=r(75748),s=e([a]);async function i(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),n=new Set(t);if(0===r.length)return[...n];for(let e of(await a.db.query(`
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
    `,[r])).rows)n.add(e.id);return[...n]}async function u(e,t){return"admin"===e.role||!!t&&(await i(e)).includes(t)}a=(s.then?(await s)():s)[0],n()}catch(e){n(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var n=r(41482),a=r.n(n),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=a().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{r:()=>u});var a=r(75748),s=r(74034),i=e([a,s]);async function u(e){if(!e||"undefined"===e)return null;let t=(await a.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,s.Z)(e),n=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:n?.departmentId??null,departmentName:n?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[a,s]=i.then?(await i)():i,n()}catch(e){n(e)}})},74034:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{Z:()=>i});var a=r(75748),s=e([a]);async function i(e){return(await a.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}a=(s.then?(await s)():s)[0],n()}catch(e){n(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972,1482,1585],()=>r(17867));module.exports=n})();