"use strict";(()=>{var e={};e.id=9922,e.ids=[9922],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},62587:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>p});var n=r(49303),i=r(88716),d=r(60670),u=r(95340),s=e([u]);u=(s.then?(await s)():s)[0];let c=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/chat/pins/[pinId]/route",pathname:"/api/chat/pins/[pinId]",filename:"route",bundlePath:"app/api/chat/pins/[pinId]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\pins\\[pinId]\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:l}=c,E="/api/chat/pins/[pinId]/route";function o(){return(0,d.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},95340:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{DELETE:()=>m});var n=r(87070),i=r(75748),d=r(56039),u=r(23016),s=r(61165),o=r(91978),c=e([i,d,o]);async function m(e,t){let r=(0,s.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,o.r)(r.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{pinId:c}=t.params,m=await i.db.query("SELECT channel_id::text FROM channel_pinned_messages WHERE id = $1::uuid",[c]),p=m.rows[0]?.channel_id;if(!p)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});let l=await i.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[p]),E=l.rows[0]?.kind??"",_=await i.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${u.F}
    LIMIT 1
    `,[r.sub,p]);return _.rows[0]?.ok?await (0,d.D)(a,p,E)?(await i.db.query("DELETE FROM channel_pinned_messages WHERE id = $1::uuid",[c]),n.NextResponse.json({ok:!0})):n.NextResponse.json({message:"권한이 없습니다."},{status:403}):n.NextResponse.json({message:"접근할 수 없습니다."},{status:403})}[i,d,o]=c.then?(await c)():c,a()}catch(e){a(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>a});let a=`
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
`},56039:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{B:()=>d,D:()=>u});var n=r(75748),i=e([n]);async function d(e,t){let r=await n.db.query(`
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
    `,[e,t]);return!!r.rows[0]?.ok}async function u(e,t,r){return"admin"===e.role||"manager"===e.role||("cross_team"===r||"group_dm"===r)&&d(e.id,t)}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var a=r(41482),n=r.n(a),i=r(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var n=r(75748),i=r(74034),d=e([n,i]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})}};var t=require("../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(62587));module.exports=a})();