"use strict";(()=>{var e={};e.id=7062,e.ids=[7062],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},29994:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.r(r),t.d(r,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>p});var a=t(49303),i=t(88716),s=t(60670),u=t(57911),d=e([u]);u=(d.then?(await d)():d)[0];let c=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/chat/channels/[id]/leave/route",pathname:"/api/chat/channels/[id]/leave",filename:"route",bundlePath:"app/api/chat/channels/[id]/leave/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\[id]\\leave\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:m}=c,E="/api/chat/channels/[id]/leave/route";function o(){return(0,s.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:p})}n()}catch(e){n(e)}})},57911:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.r(r),t.d(r,{POST:()=>c});var a=t(87070),i=t(75748),s=t(56039),u=t(23016),d=t(61165),o=e([i,s]);async function c(e,r){let t=(0,d.v6)(e);if(!t)return a.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:n}=r.params,o=await i.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[n]),c=o.rows[0]?.kind;if("group_dm"!==c&&"cross_team"!==c)return a.NextResponse.json({message:"이 채널에서는 나가기를 지원하지 않습니다."},{status:400});let l=await i.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${u.F}
    LIMIT 1
    `,[t.sub,n]);return l.rows[0]?.ok?await (0,s.B)(t.sub,n)?a.NextResponse.json({message:"호스트는 채팅방을 삭제하거나, 다른 호스트에게 위임한 뒤 나갈 수 있습니다."},{status:400}):(await i.db.query("DELETE FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid",[n,t.sub]),a.NextResponse.json({ok:!0})):a.NextResponse.json({message:"접근할 수 없습니다."},{status:403})}[i,s]=o.then?(await o)():o,n()}catch(e){n(e)}})},23016:(e,r,t)=>{t.d(r,{F:()=>n});let n=`
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
`},56039:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.d(r,{B:()=>s,D:()=>u});var a=t(75748),i=e([a]);async function s(e,r){let t=await a.db.query(`
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
    `,[e,r]);return!!t.rows[0]?.ok}async function u(e,r,t){return"admin"===e.role||"manager"===e.role||("cross_team"===t||"group_dm"===t)&&s(e.id,r)}a=(i.then?(await i)():i)[0],n()}catch(e){n(e)}})},1923:(e,r,t)=>{t.d(r,{S:()=>a,l:()=>n});let n="auth_token",a="password_change_required"},75748:(e,r,t)=>{t.a(e,async(e,n)=>{try{t.d(r,{db:()=>s});var a=t(8678),i=e([a]);a=(i.then?(await i)():i)[0];let s=global.__pgPool??new a.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},61165:(e,r,t)=>{t.d(r,{v6:()=>s});var n=t(41482),a=t.n(n),i=t(1923);function s(e){let r=e.cookies.get(i.l)?.value;return r?function(e){try{let r=a().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof r&&null!==r&&"sub"in r&&"email"in r)return{sub:String(r.sub),email:String(r.email)};return null}catch{return null}}(r):null}}};var r=require("../../../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),n=r.X(0,[9276,5972,1482],()=>t(29994));module.exports=n})();