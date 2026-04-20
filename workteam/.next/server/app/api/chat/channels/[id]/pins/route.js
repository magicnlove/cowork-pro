"use strict";(()=>{var e={};e.id=7032,e.ids=[7032],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},64447:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>p,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>m});var a=r(49303),i=r(88716),d=r(60670),s=r(62250),u=e([s]);s=(u.then?(await u)():u)[0];let c=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/chat/channels/[id]/pins/route",pathname:"/api/chat/channels/[id]/pins",filename:"route",bundlePath:"app/api/chat/channels/[id]/pins/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\[id]\\pins\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:l}=c,E="/api/chat/channels/[id]/pins/route";function o(){return(0,d.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:m})}n()}catch(e){n(e)}})},62250:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.r(t),r.d(t,{GET:()=>o});var a=r(87070),i=r(75748),d=r(23016),s=r(61165),u=e([i]);async function o(e,t){let r=(0,s.v6)(e);if(!r)return a.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:n}=t.params,u=await i.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[r.sub,n]);if(!u.rows[0]?.ok)return a.NextResponse.json({message:"접근할 수 없습니다."},{status:403});let o=(await i.db.query(`
    SELECT
      p.id::text AS pid,
      m.id::text AS mid,
      m.body,
      u.name AS user_name,
      m.created_at
    FROM channel_pinned_messages p
    JOIN messages m ON m.id = p.message_id AND m.deleted_at IS NULL
    JOIN users u ON u.id = m.user_id
    WHERE p.channel_id = $1::uuid
    ORDER BY p.created_at DESC
    `,[n])).rows.map(e=>({pinId:e.pid,messageId:e.mid,channelId:n,body:e.body,userName:e.user_name,createdAt:e.created_at.toISOString()}));return a.NextResponse.json({pins:o})}i=(u.then?(await u)():u)[0],n()}catch(e){n(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>n});let n=`
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
`},1923:(e,t,r)=>{r.d(t,{S:()=>a,l:()=>n});let n="auth_token",a="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,n)=>{try{r.d(t,{db:()=>d});var a=r(8678),i=e([a]);a=(i.then?(await i)():i)[0];let d=global.__pgPool??new a.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var n=r(41482),a=r.n(n),i=r(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=a().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972,1482],()=>r(64447));module.exports=n})();