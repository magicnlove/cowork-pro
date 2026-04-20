"use strict";(()=>{var e={};e.id=1278,e.ids=[1278],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},54911:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>l});var n=r(49303),s=r(88716),i=r(60670),d=r(74864),u=e([d]);d=(u.then?(await u)():u)[0];let p=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/admin/departments/route",pathname:"/api/admin/departments",filename:"route",bundlePath:"app/api/admin/departments/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\admin\\departments\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:m,staticGenerationAsyncStorage:l,serverHooks:c}=p,_="/api/admin/departments/route";function o(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},74864:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>m,POST:()=>l});var n=r(87070),s=r(91585),i=r(75748),d=r(1327),u=r(61165),o=r(91978),p=e([i,o]);[i,o]=p.then?(await p)():p;let c=s.Ry({name:s.Z_().min(1).max(200),code:s.Z_().min(1).max(64),parentId:s.Z_().uuid().nullable().optional(),sortOrder:s.Rx().int().min(0).optional()});async function m(e){let t=(0,u.v6)(e);if(!t)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,o.r)(t.sub),a=(0,d.v)(r);if(a)return a;let s=await i.db.query(`
    SELECT
      id::text,
      name,
      code,
      parent_id::text,
      manager_user_id::text,
      depth,
      sort_order,
      created_at
    FROM departments
    ORDER BY depth ASC, sort_order ASC, name ASC
    `);return n.NextResponse.json({departments:s.rows.map(e=>({id:e.id,name:e.name,code:e.code,parentId:e.parent_id,managerUserId:e.manager_user_id,depth:e.depth,sortOrder:e.sort_order,createdAt:e.created_at.toISOString()}))})}async function l(e){let t;let r=(0,u.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,o.r)(r.sub),s=(0,d.v)(a);if(s)return s;try{t=await e.json()}catch{return n.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let p=c.safeParse(t);if(!p.success)return n.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:p.error.flatten()},{status:400});let{name:m,code:l,parentId:_=null,sortOrder:f=0}=p.data,x=0;if(_){let e=await i.db.query("SELECT depth FROM departments WHERE id = $1::uuid LIMIT 1",[_]);if(0===e.rowCount)return n.NextResponse.json({message:"상위 부서를 찾을 수 없습니다."},{status:400});x=e.rows[0].depth+1}try{let e=(await i.db.query(`
      INSERT INTO departments (name, code, parent_id, depth, sort_order)
      VALUES ($1, $2, $3::uuid, $4, $5)
      RETURNING id::text
      `,[m,l,_,x,f])).rows[0].id,t=`dept-${l.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${e.slice(0,8)}`;return await i.db.query(`
      INSERT INTO channels (slug, name, kind, department_id)
      VALUES ($1, $2, 'department', $3::uuid)
      `,[t,`# ${m} \xb7 부서`,e]),n.NextResponse.json({id:e})}catch(e){return console.error("[POST /api/admin/departments]",e),n.NextResponse.json({message:"부서를 저장하지 못했습니다."},{status:500})}}a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),s=e([n]);n=(s.then?(await s)():s)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},1327:(e,t,r)=>{r.d(t,{v:()=>n});var a=r(87070);function n(e){return e?"admin"!==e.role?a.NextResponse.json({message:"관리자만 접근할 수 있습니다."},{status:403}):null:a.NextResponse.json({message:"로그인이 필요합니다."},{status:401})}},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>d});var n=r(75748),s=r(74034),i=e([n,s]);async function d(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>r(54911));module.exports=a})();