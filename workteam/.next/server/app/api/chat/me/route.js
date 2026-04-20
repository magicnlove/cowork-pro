"use strict";(()=>{var e={};e.id=8080,e.ids=[8080],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},22210:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>_,patchFetch:()=>d,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var n=r(49303),s=r(88716),i=r(60670),u=r(49358),o=e([u]);u=(o.then?(await o)():o)[0];let p=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/chat/me/route",pathname:"/api/chat/me",filename:"route",bundlePath:"app/api/chat/me/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\me\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:c}=p,_="/api/chat/me/route";function d(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}a()}catch(e){a(e)}})},49358:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>o});var n=r(87070),s=r(75748),i=r(61165),u=e([s]);async function o(e){let t=(0,i.v6)(e);if(!t)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=(await s.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role,
      u.is_temp_password,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'departmentId', ud.department_id::text,
            'departmentName', d.name,
            'isPrimary', ud.is_primary,
            'role', ud.role
          )
          ORDER BY ud.is_primary DESC, d.name ASC
        ) FILTER (WHERE ud.id IS NOT NULL),
        '[]'::json
      ) AS departments
    FROM users u
    LEFT JOIN user_departments ud ON ud.user_id = u.id
    LEFT JOIN departments d ON d.id = ud.department_id
    WHERE u.id = $1::uuid
    GROUP BY u.id, u.email, u.name, u.role, u.is_temp_password
    LIMIT 1
    `,[t.sub])).rows[0];if(!r)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:404});let a=r.departments.find(e=>e.isPrimary)??r.departments[0]??null,u=r.departments.filter(e=>!e.isPrimary);return n.NextResponse.json({user:{id:r.id,email:r.email,name:r.name,role:r.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departmentRole:a?.role??null,isTempPassword:r.is_temp_password,secondaryDepartments:u}})}s=(u.then?(await u)():u)[0],a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),s=e([n]);n=(s.then?(await s)():s)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(22210));module.exports=a})();