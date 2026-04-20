"use strict";(()=>{var e={};e.id=8085,e.ids=[8085],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},74543:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var n=r(49303),s=r(88716),i=r(60670),u=r(75863),d=e([u]);u=(d.then?(await d)():d)[0];let p=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/admin/password-reset-requests/[id]/reject/route",pathname:"/api/admin/password-reset-requests/[id]/reject",filename:"route",bundlePath:"app/api/admin/password-reset-requests/[id]/reject/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\admin\\password-reset-requests\\[id]\\reject\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:c}=p,y="/api/admin/password-reset-requests/[id]/reject/route";function o(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}a()}catch(e){a(e)}})},75863:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>p});var n=r(87070),s=r(75748),i=r(1327),u=r(61165),d=r(91978),o=e([s,d]);async function p(e,t){let r=(0,u.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,d.r)(r.sub),o=(0,i.v)(a);if(o)return o;let p=t.params.id,l=await s.db.query(`
    UPDATE password_reset_requests
    SET status = 'rejected'
    WHERE id = $1::uuid AND status = 'pending'
    RETURNING id::text
    `,[p]);return 0===l.rowCount?n.NextResponse.json({message:"거절할 수 있는 요청이 없습니다."},{status:400}):n.NextResponse.json({ok:!0})}[s,d]=o.then?(await o)():o,a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),s=e([n]);n=(s.then?(await s)():s)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},1327:(e,t,r)=>{r.d(t,{v:()=>n});var a=r(87070);function n(e){return e?"admin"!==e.role?a.NextResponse.json({message:"관리자만 접근할 수 있습니다."},{status:403}):null:a.NextResponse.json({message:"로그인이 필요합니다."},{status:401})}},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var n=r(75748),s=r(74034),i=e([n,s]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,s.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,s]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>i});var n=r(75748),s=e([n]);async function i(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(74543));module.exports=a})();