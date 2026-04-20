"use strict";(()=>{var e={};e.id=4111,e.ids=[4111],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},14816:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>E,staticGenerationAsyncStorage:()=>p});var n=r(49303),i=r(88716),d=r(60670),u=r(60780),s=e([u]);u=(s.then?(await s)():s)[0];let c=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/chat/channels/[id]/read/route",pathname:"/api/chat/channels/[id]/read",filename:"route",bundlePath:"app/api/chat/channels/[id]/read/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\[id]\\read\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:E}=c,m="/api/chat/channels/[id]/read/route";function o(){return(0,d.patchFetch)({serverHooks:E,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},60780:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>c});var n=r(87070),i=r(75748),d=r(23016),u=r(61165),s=e([i]);async function o(e,t){let r=await i.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[e,t]);return!!r.rows[0]?.ok}async function c(e,t){let r=(0,u.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:a}=t.params;if(!await o(r.sub,a))return n.NextResponse.json({message:"채널에 접근할 수 없습니다."},{status:403});let d=await i.db.query(`
    SELECT MAX(created_at) AS t
    FROM messages
    WHERE channel_id = $1::uuid AND parent_message_id IS NULL
    `,[a]),s=d.rows[0]?.t??new Date;return await i.db.query(`
    INSERT INTO channel_reads (user_id, channel_id, last_read_at)
    VALUES ($1::uuid, $2::uuid, $3::timestamptz)
    ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `,[r.sub,a,s]),n.NextResponse.json({ok:!0})}i=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>a});let a=`
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
`},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>d});var n=r(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>d});var a=r(41482),n=r.n(a),i=r(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(14816));module.exports=a})();