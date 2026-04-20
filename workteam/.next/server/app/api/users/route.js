"use strict";(()=>{var e={};e.id=5701,e.ids=[5701],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},11810:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>l,patchFetch:()=>s,requestAsyncStorage:()=>E,routeModule:()=>m,serverHooks:()=>c,staticGenerationAsyncStorage:()=>o});var d=r(49303),n=r(88716),p=r(60670),i=r(76851),u=e([i]);i=(u.then?(await u)():u)[0];let m=new d.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/users/route",pathname:"/api/users",filename:"route",bundlePath:"app/api/users/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\users\\route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:E,staticGenerationAsyncStorage:o,serverHooks:c}=m,l="/api/users/route";function s(){return(0,p.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:o})}a()}catch(e){a(e)}})},76851:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>u});var d=r(87070),n=r(75748),p=r(61165),i=e([n]);async function u(e){if(!(0,p.v6)(e))return d.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let t=e.nextUrl.searchParams.get("q")?.trim()??"",r=e.nextUrl.searchParams.get("departmentId")?.trim()??"",a=t.length>0?`%${t.replace(/%/g,"\\%").replace(/_/g,"\\_")}%`:null,i=/^[0-9a-fA-F-]{36}$/.test(r),u=await n.db.query(a?`
        WITH RECURSIVE dept_path AS (
          SELECT d.id, d.name::text AS path
          FROM departments d
          WHERE d.parent_id IS NULL
          UNION ALL
          SELECT c.id, (p.path || ' > ' || c.name)::text
          FROM departments c
          INNER JOIN dept_path p ON p.id = c.parent_id
        )
        SELECT
          u.id,
          u.name,
          u.email,
          pud.department_id::text AS department_id,
          d.name AS department_name,
          dp.path AS department_path
        FROM users u
        LEFT JOIN LATERAL (
          SELECT ud.department_id
          FROM user_departments ud
          WHERE ud.user_id = u.id
          ORDER BY ud.is_primary DESC, ud.created_at ASC
          LIMIT 1
        ) pud ON TRUE
        LEFT JOIN departments d ON d.id = pud.department_id
        LEFT JOIN dept_path dp ON dp.id = pud.department_id
        WHERE
          u.name ILIKE $1 ESCAPE '\\'
          OR u.email ILIKE $1 ESCAPE '\\'
          OR COALESCE(d.name, '') ILIKE $1 ESCAPE '\\'
          OR COALESCE(dp.path, '') ILIKE $1 ESCAPE '\\'
          ${i?"OR pud.department_id = $2::uuid":""}
        ORDER BY u.name ASC
        LIMIT 300
      `:`
        WITH RECURSIVE dept_path AS (
          SELECT d.id, d.name::text AS path
          FROM departments d
          WHERE d.parent_id IS NULL
          UNION ALL
          SELECT c.id, (p.path || ' > ' || c.name)::text
          FROM departments c
          INNER JOIN dept_path p ON p.id = c.parent_id
        )
        SELECT
          u.id,
          u.name,
          u.email,
          pud.department_id::text AS department_id,
          d.name AS department_name,
          dp.path AS department_path
        FROM users u
        LEFT JOIN LATERAL (
          SELECT ud.department_id
          FROM user_departments ud
          WHERE ud.user_id = u.id
          ORDER BY ud.is_primary DESC, ud.created_at ASC
          LIMIT 1
        ) pud ON TRUE
        LEFT JOIN departments d ON d.id = pud.department_id
        LEFT JOIN dept_path dp ON dp.id = pud.department_id
        ${i?"WHERE pud.department_id = $1::uuid":""}
        ORDER BY u.name ASC
        LIMIT 500
      `,a?i?[a,r]:[a]:i?[r]:[]);return d.NextResponse.json({users:u.rows.map(e=>({id:e.id,name:e.name,email:e.email,departmentId:e.department_id,departmentName:e.department_name,departmentPath:e.department_path}))})}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>d,l:()=>a});let a="auth_token",d="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>p});var d=r(8678),n=e([d]);d=(n.then?(await n)():n)[0];let p=global.__pgPool??new d.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>p});var a=r(41482),d=r.n(a),n=r(1923);function p(e){let t=e.cookies.get(n.l)?.value;return t?function(e){try{let t=d().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(11810));module.exports=a})();