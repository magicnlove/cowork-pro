"use strict";(()=>{var e={};e.id=962,e.ids=[962],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},92312:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>d,requestAsyncStorage:()=>l,routeModule:()=>m,serverHooks:()=>p,staticGenerationAsyncStorage:()=>c});var n=r(49303),s=r(88716),i=r(60670),u=r(48424),o=e([u]);u=(o.then?(await o)():o)[0];let m=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/chat/cross-team/route",pathname:"/api/chat/cross-team",filename:"route",bundlePath:"app/api/chat/cross-team/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\cross-team\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:p}=m,y="/api/chat/cross-team/route";function d(){return(0,i.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:c})}a()}catch(e){a(e)}})},48424:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>m});var n=r(87070),s=r(91585),i=r(75748),u=r(61165),o=r(91978),d=e([i,o]);[i,o]=d.then?(await d)():d;let l=s.Ry({name:s.Z_().min(1).max(120),memberUserIds:s.IX(s.Z_().uuid()).max(50).optional()});async function m(e){let t;let r=(0,u.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,o.r)(r.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});if("admin"!==a.role&&"manager"!==a.role)return n.NextResponse.json({message:"크로스팀 채널은 관리자\xb7매니저만 생성할 수 있습니다."},{status:403});try{t=await e.json()}catch{return n.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let s=l.safeParse(t);if(!s.success)return n.NextResponse.json({message:"입력값이 올바르지 않습니다."},{status:400});let d=r.sub,m=Array.from(new Set([d,...s.data.memberUserIds??[]])),c=`xt-${crypto.randomUUID()}`,p=await i.db.connect();try{await p.query("BEGIN");let e=(await p.query(`
      INSERT INTO channels (slug, name, kind, created_by)
      VALUES ($1, $2, 'cross_team', $3::uuid)
      RETURNING id::text
      `,[c,s.data.name.trim(),d])).rows[0].id;for(let t of m){let r=t===d?"host":"member";await p.query(`
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT (channel_id, user_id) DO NOTHING
        `,[e,t,r])}return await p.query("COMMIT"),n.NextResponse.json({channelId:e})}catch(e){return await p.query("ROLLBACK"),console.error("[POST /api/chat/cross-team]",e),n.NextResponse.json({message:"채널을 만들지 못했습니다."},{status:500})}finally{p.release()}}a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),s=e([n]);n=(s.then?(await s)():s)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var n=r(75748),s=r(74034),i=e([n,s]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>r(92312));module.exports=a})();