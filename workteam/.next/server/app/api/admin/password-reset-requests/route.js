"use strict";(()=>{var e={};e.id=4766,e.ids=[4766],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},85975:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.r(r),t.d(r,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>l});var s=t(49303),n=t(88716),i=t(60670),u=t(25129),d=e([u]);u=(d.then?(await d)():d)[0];let p=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/admin/password-reset-requests/route",pathname:"/api/admin/password-reset-requests",filename:"route",bundlePath:"app/api/admin/password-reset-requests/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\admin\\password-reset-requests\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:m,staticGenerationAsyncStorage:l,serverHooks:c}=p,_="/api/admin/password-reset-requests/route";function o(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},25129:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.r(r),t.d(r,{GET:()=>p});var s=t(87070),n=t(75748),i=t(1327),u=t(61165),d=t(91978),o=e([n,d]);async function p(e){let r=(0,u.v6)(e);if(!r)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let t=await (0,d.r)(r.sub),a=(0,i.v)(t);if(a)return a;let o=await n.db.query(`
    SELECT
      r.id::text,
      r.user_id::text,
      r.status,
      r.created_at,
      u.email AS user_email,
      u.name AS user_name
    FROM password_reset_requests r
    INNER JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC
    LIMIT 200
    `);return s.NextResponse.json({requests:o.rows.map(e=>({id:e.id,userId:e.user_id,status:e.status,createdAt:e.created_at.toISOString(),userEmail:e.user_email,userName:e.user_name}))})}[n,d]=o.then?(await o)():o,a()}catch(e){a(e)}})},1923:(e,r,t)=>{t.d(r,{S:()=>s,l:()=>a});let a="auth_token",s="password_change_required"},75748:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{db:()=>i});var s=t(8678),n=e([s]);s=(n.then?(await n)():n)[0];let i=global.__pgPool??new s.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},1327:(e,r,t)=>{t.d(r,{v:()=>s});var a=t(87070);function s(e){return e?"admin"!==e.role?a.NextResponse.json({message:"관리자만 접근할 수 있습니다."},{status:403}):null:a.NextResponse.json({message:"로그인이 필요합니다."},{status:401})}},61165:(e,r,t)=>{t.d(r,{v6:()=>i});var a=t(41482),s=t.n(a),n=t(1923);function i(e){let r=e.cookies.get(n.l)?.value;return r?function(e){try{let r=s().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof r&&null!==r&&"sub"in r&&"email"in r)return{sub:String(r.sub),email:String(r.email)};return null}catch{return null}}(r):null}},91978:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{r:()=>u});var s=t(75748),n=t(74034),i=e([s,n]);async function u(e){if(!e||"undefined"===e)return null;let r=(await s.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!r)return null;let t=await (0,n.Z)(e),a=t.find(e=>e.isPrimary)??t[0]??null;return{id:r.id,email:r.email,name:r.name,role:r.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:t.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[s,n]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{Z:()=>i});var s=t(75748),n=e([s]);async function i(e){return(await s.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}s=(n.then?(await n)():n)[0],a()}catch(e){a(e)}})}};var r=require("../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[9276,5972,1482],()=>t(85975));module.exports=a})();