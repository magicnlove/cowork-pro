"use strict";(()=>{var e={};e.id=4665,e.ids=[4665],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},70724:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.r(r),t.d(r,{originalPathname:()=>l,patchFetch:()=>c,requestAsyncStorage:()=>E,routeModule:()=>o,serverHooks:()=>p,staticGenerationAsyncStorage:()=>m});var a=t(49303),d=t(88716),i=t(60670),u=t(22691),s=e([u]);u=(s.then?(await s)():s)[0];let o=new a.AppRouteRouteModule({definition:{kind:d.x.APP_ROUTE,page:"/api/chat/channels/route",pathname:"/api/chat/channels",filename:"route",bundlePath:"app/api/chat/channels/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:E,staticGenerationAsyncStorage:m,serverHooks:p}=o,l="/api/chat/channels/route";function c(){return(0,i.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:m})}n()}catch(e){n(e)}})},22691:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.r(r),t.d(r,{GET:()=>c});var a=t(87070),d=t(75748),i=t(23016),u=t(61165),s=e([d]);async function c(e){let r=(0,u.v6)(e);if(!r)return a.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let t=(await d.db.query(`
    SELECT
      c.id,
      c.slug,
      c.kind,
      c.name,
      CASE
        WHEN c.kind = 'dm' THEN COALESCE(
          (
            SELECT u2.name FROM users u2
            WHERE u2.id IN (c.dm_user_a_id, c.dm_user_b_id) AND u2.id <> $1::uuid
            LIMIT 1
          ),
          c.name
        )
        ELSE TRIM(LEADING '# ' FROM c.name)
      END AS display_name,
      COALESCE(
        (
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.channel_id = c.id
            AND m.parent_message_id IS NULL
            AND m.deleted_at IS NULL
            AND m.user_id <> $1::uuid
            AND m.created_at > COALESCE(cr.last_read_at, to_timestamp(0))
        ),
        0
      ) AS unread_count
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    LEFT JOIN channel_reads cr ON cr.channel_id = c.id AND cr.user_id = $1::uuid
    WHERE ${i.F}
    ORDER BY
      CASE c.kind
        WHEN 'company_wide' THEN 0
        WHEN 'department' THEN 1
        WHEN 'cross_team' THEN 2
        WHEN 'group_dm' THEN 3
        WHEN 'dm' THEN 4
        ELSE 5
      END,
      display_name ASC
    `,[r.sub])).rows.map(e=>({id:e.id,slug:e.slug,kind:e.kind,name:e.name,displayName:e.display_name,unreadCount:e.unread_count}));return a.NextResponse.json({channels:t})}d=(s.then?(await s)():s)[0],n()}catch(e){n(e)}})},23016:(e,r,t)=>{t.d(r,{F:()=>n});let n=`
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
`},1923:(e,r,t)=>{t.d(r,{S:()=>a,l:()=>n});let n="auth_token",a="password_change_required"},75748:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.d(r,{db:()=>i});var a=t(8678),d=e([a]);a=(d.then?(await d)():d)[0];let i=global.__pgPool??new a.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},61165:(e,r,t)=>{t.d(r,{v6:()=>i});var n=t(41482),a=t.n(n),d=t(1923);function i(e){let r=e.cookies.get(d.l)?.value;return r?function(e){try{let r=a().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof r&&null!==r&&"sub"in r&&"email"in r)return{sub:String(r.sub),email:String(r.email)};return null}catch{return null}}(r):null}}};var r=require("../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),n=r.X(0,[9276,5972,1482],()=>t(70724));module.exports=n})();