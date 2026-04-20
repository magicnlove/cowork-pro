"use strict";(()=>{var e={};e.id=767,e.ids=[767],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},73267:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>c,serverHooks:()=>p,staticGenerationAsyncStorage:()=>l});var n=r(49303),d=r(88716),i=r(60670),u=r(35565),s=e([u]);u=(s.then?(await s)():s)[0];let c=new n.AppRouteRouteModule({definition:{kind:d.x.APP_ROUTE,page:"/api/chat/channels/[id]/route",pathname:"/api/chat/channels/[id]",filename:"route",bundlePath:"app/api/chat/channels/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\[id]\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:m,staticGenerationAsyncStorage:l,serverHooks:p}=c,E="/api/chat/channels/[id]/route";function o(){return(0,i.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},35565:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{DELETE:()=>m});var n=r(87070),d=r(75748),i=r(56039),u=r(23016),s=r(61165),o=r(91978),c=e([d,i,o]);async function m(e,t){let r=(0,s.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,o.r)(r.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:c}=t.params,m=await d.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[c]),l=m.rows[0]?.kind;if(!l)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if("group_dm"!==l&&"cross_team"!==l)return n.NextResponse.json({message:"삭제할 수 없는 채널 유형입니다."},{status:400});let p=await d.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${u.F}
    LIMIT 1
    `,[r.sub,c]);return p.rows[0]?.ok?"admin"===a.role||"manager"===a.role||await (0,i.B)(r.sub,c)?(await d.db.query("DELETE FROM channels WHERE id = $1::uuid",[c]),n.NextResponse.json({ok:!0})):n.NextResponse.json({message:"호스트만 채널을 삭제할 수 있습니다."},{status:403}):n.NextResponse.json({message:"접근할 수 없습니다."},{status:403})}[d,i,o]=c.then?(await c)():c,a()}catch(e){a(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>a});let a=`
(
  (c.kind = 'dm' AND $1::uuid IN (c.dm_user_a_id, c.dm_user_b_id))
  OR (c.kind = 'company_wide')
  OR (
    c.kind = 'department'
    AND (
      EXISTS (
        SELECT 1
        FROM user_departments ud
        WHERE ud.user_id = $1::uuid
          AND ud.department_id = c.department_id
      )
      OR EXISTS (
        WITH RECURSIVE managed AS (
          SELECT ud.department_id AS id
          FROM user_departments ud
          INNER JOIN users ux ON ux.id = ud.user_id
          WHERE ud.user_id = $1::uuid
            AND ud.role = 'manager'
            AND ux.role = 'manager'
          UNION ALL
          SELECT d.id
          FROM departments d
          INNER JOIN managed m ON d.parent_id = m.id
        )
        SELECT 1 FROM managed WHERE id = c.department_id
      )
    )
  )
  OR (
    c.kind IN ('cross_team', 'group_dm')
    AND (
      EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.channel_id = c.id AND cm.user_id = $1::uuid
      )
      OR c.created_by = $1::uuid
    )
  )
)
`},56039:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{B:()=>i,D:()=>u});var n=r(75748),d=e([n]);async function i(e,t){let r=await n.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    WHERE c.id = $2::uuid
      AND c.kind IN ('cross_team', 'group_dm')
      AND (
        EXISTS (
          SELECT 1 FROM channel_members cm
          WHERE cm.channel_id = c.id AND cm.user_id = $1::uuid AND cm.role = 'host'
        )
        OR c.created_by = $1::uuid
      )
    LIMIT 1
    `,[e,t]);return!!r.rows[0]?.ok}async function u(e,t,r){return"admin"===e.role||"manager"===e.role||("cross_team"===r||"group_dm"===r)&&i(e.id,t)}n=(d.then?(await d)():d)[0],a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),d=e([n]);n=(d.then?(await d)():d)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),d=r(1923);function i(e){let t=e.cookies.get(d.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var n=r(75748),d=r(74034),i=e([n,d]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,d.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,d]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>i});var n=r(75748),d=e([n]);async function i(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(d.then?(await d)():d)[0],a()}catch(e){a(e)}})}};var t=require("../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(73267));module.exports=a})();