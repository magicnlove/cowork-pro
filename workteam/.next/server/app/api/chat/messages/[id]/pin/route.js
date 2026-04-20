"use strict";(()=>{var e={};e.id=9607,e.ids=[9607],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},16694:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>c,routeModule:()=>m,serverHooks:()=>l,staticGenerationAsyncStorage:()=>p});var a=r(49303),i=r(88716),s=r(60670),d=r(14926),u=e([d]);d=(u.then?(await u)():u)[0];let m=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/chat/messages/[id]/pin/route",pathname:"/api/chat/messages/[id]/pin",filename:"route",bundlePath:"app/api/chat/messages/[id]/pin/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\messages\\[id]\\pin\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:c,staticGenerationAsyncStorage:p,serverHooks:l}=m,E="/api/chat/messages/[id]/pin/route";function o(){return(0,s.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:p})}n()}catch(e){n(e)}})},14926:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{POST:()=>c});var a=r(87070),i=r(75748),s=r(56039),d=r(23016),u=r(61165),o=r(91978),m=e([i,s,o]);async function c(e,t){let r=(0,u.v6)(e);if(!r)return a.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let n=await (0,o.r)(r.sub);if(!n)return a.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:m}=t.params,c=(await i.db.query("SELECT channel_id::text, parent_message_id::text FROM messages WHERE id = $1::uuid AND deleted_at IS NULL",[m])).rows[0];if(!c)return a.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(c.parent_message_id)return a.NextResponse.json({message:"스레드 댓글은 고정할 수 없습니다."},{status:400});let p=await i.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[c.channel_id]),l=p.rows[0]?.kind;if(!l)return a.NextResponse.json({message:"채널을 찾을 수 없습니다."},{status:404});let E=await i.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[r.sub,c.channel_id]);if(!E.rows[0]?.ok)return a.NextResponse.json({message:"접근할 수 없습니다."},{status:403});if(!await (0,s.D)(n,c.channel_id,l))return a.NextResponse.json({message:"고정 권한이 없습니다."},{status:403});try{let e=await i.db.query(`
      INSERT INTO channel_pinned_messages (channel_id, message_id, pinned_by)
      VALUES ($1::uuid, $2::uuid, $3::uuid)
      ON CONFLICT (channel_id, message_id) DO NOTHING
      RETURNING id::text
      `,[c.channel_id,m,r.sub]);if(0===e.rowCount){let e=await i.db.query("SELECT id::text FROM channel_pinned_messages WHERE channel_id = $1::uuid AND message_id = $2::uuid",[c.channel_id,m]);return a.NextResponse.json({pinId:e.rows[0]?.id??null,alreadyPinned:!0})}return a.NextResponse.json({pinId:e.rows[0]?.id,alreadyPinned:!1})}catch(e){return console.error("[pin]",e),a.NextResponse.json({message:"고정하지 못했습니다."},{status:500})}}[i,s,o]=m.then?(await m)():m,n()}catch(e){n(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>n});let n=`
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
`},56039:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{B:()=>s,D:()=>d});var a=r(75748),i=e([a]);async function s(e,t){let r=await a.db.query(`
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
    `,[e,t]);return!!r.rows[0]?.ok}async function d(e,t,r){return"admin"===e.role||"manager"===e.role||("cross_team"===r||"group_dm"===r)&&s(e.id,t)}a=(i.then?(await i)():i)[0],n()}catch(e){n(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>a,l:()=>n});let n="auth_token",a="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{db:()=>s});var a=r(8678),i=e([a]);a=(i.then?(await i)():i)[0];let s=global.__pgPool??new a.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>s});var n=r(41482),a=r.n(n),i=r(1923);function s(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=a().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{r:()=>d});var a=r(75748),i=r(74034),s=e([a,i]);async function d(e){if(!e||"undefined"===e)return null;let t=(await a.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,i.Z)(e),n=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:n?.departmentId??null,departmentName:n?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[a,i]=s.then?(await s)():s,n()}catch(e){n(e)}})},74034:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{Z:()=>s});var a=r(75748),i=e([a]);async function s(e){return(await a.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}a=(i.then?(await i)():i)[0],n()}catch(e){n(e)}})}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972,1482],()=>r(16694));module.exports=n})();