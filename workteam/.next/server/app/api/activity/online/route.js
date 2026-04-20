"use strict";(()=>{var e={};e.id=928,e.ids=[928],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},58075:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p});var n=r(49303),i=r(88716),u=r(60670),d=r(25221),s=e([d]);d=(s.then?(await s)():s)[0];let l=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/activity/online/route",pathname:"/api/activity/online",filename:"route",bundlePath:"app/api/activity/online/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\activity\\online\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:c}=l,E="/api/activity/online/route";function o(){return(0,u.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},25221:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>m});var n=r(87070),i=r(75748),u=r(90224),d=r(27754),s=r(61165),o=r(91978),l=e([i,d,o]);async function m(e){let t=(0,s.v6)(e);if(!t)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,o.r)(t.sub);if(!r)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let a=(0,u.P)();if(0===a.length)return n.NextResponse.json({users:[]});let l=["u.id = ANY($1::uuid[])"],m=[a],p=2;if("admin"!==r.role){let e=await (0,d.J)(r);l.push(`EXISTS (
      SELECT 1
      FROM user_departments uds
      WHERE uds.user_id = u.id
        AND uds.department_id = ANY($${p}::uuid[])
    )`),m.push(e),p+=1}let c=await i.db.query(`
    SELECT
      u.id::text,
      u.name,
      u.email,
      d.name AS department_name
    FROM users u
    LEFT JOIN LATERAL (
      SELECT ud.department_id
      FROM user_departments ud
      WHERE ud.user_id = u.id
      ORDER BY ud.is_primary DESC, ud.created_at ASC
      LIMIT 1
    ) pud ON TRUE
    LEFT JOIN departments d ON d.id = pud.department_id
    WHERE ${l.join(" AND ")}
    ORDER BY u.name ASC
    LIMIT 200
    `,m);return n.NextResponse.json({users:c.rows.map(e=>({id:e.id,name:e.name,email:e.email,departmentName:e.department_name}))})}[i,d,o]=l.then?(await l)():l,a()}catch(e){a(e)}})},90224:(e,t,r)=>{r.d(t,{P:()=>a});function a(){let e=globalThis.__activityIoOnlineUserIds;try{return e?.()??[]}catch{return[]}}},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>u});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let u=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>u,d:()=>d});var n=r(75748),i=e([n]);async function u(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await n.db.query(`
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
    `,[r])).rows)a.add(e.id);return[...a]}async function d(e,t){return"admin"===e.role||!!t&&(await u(e)).includes(t)}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>u});var a=r(41482),n=r.n(a),i=r(1923);function u(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>d});var n=r(75748),i=r(74034),u=e([n,i]);async function d(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,i.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,i]=u.then?(await u)():u,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>u});var n=r(75748),i=e([n]);async function u(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(58075));module.exports=a})();