"use strict";(()=>{var e={};e.id=5384,e.ids=[5384],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},65814:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>l});var n=r(49303),i=r(88716),d=r(60670),s=r(49610),u=e([s]);s=(u.then?(await u)():u)[0];let p=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/departments/route",pathname:"/api/departments",filename:"route",bundlePath:"app/api/departments/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\departments\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:m,staticGenerationAsyncStorage:l,serverHooks:c}=p,E="/api/departments/route";function o(){return(0,d.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},49610:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>p});var n=r(87070),i=r(75748),d=r(27754),s=r(61165),u=r(91978),o=e([i,d,u]);async function p(e){let t=(0,s.v6)(e);if(!t)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,u.r)(t.sub);if(!r)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});if("admin"===r.role){let e=await i.db.query(`
      SELECT id::text, name, code, parent_id::text, depth, sort_order
      FROM departments
      ORDER BY depth ASC, sort_order ASC, name ASC
      `);return n.NextResponse.json({departments:e.rows})}let a=await (0,d.J)(r);if(0===a.length)return n.NextResponse.json({departments:[]});let o=await i.db.query(`
    SELECT id::text, name, code, parent_id::text, depth, sort_order
    FROM departments
    WHERE id = ANY($1::uuid[])
    ORDER BY depth ASC, sort_order ASC, name ASC
    `,[a]);return n.NextResponse.json({departments:o.rows})}[i,d,u]=o.then?(await o)():o,a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>d,d:()=>s});var n=r(75748),i=e([n]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(65814));module.exports=a})();