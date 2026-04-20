"use strict";(()=>{var e={};e.id=9277,e.ids=[9277],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},21398:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>p});var s=r(49303),n=r(88716),u=r(60670),d=r(82822),i=e([d]);d=(i.then?(await i)():i)[0];let c=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/chat/search/route",pathname:"/api/chat/search",filename:"route",bundlePath:"app/api/chat/search/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\search\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:l}=c,E="/api/chat/search/route";function o(){return(0,u.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},82822:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>c});var s=r(87070),n=r(91585),u=r(75748),d=r(23016),i=r(61165),o=e([u]);async function c(e){let t=(0,i.v6)(e);if(!t)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=e.nextUrl.searchParams.get("channelId"),a=e.nextUrl.searchParams.get("q"),o=r?n.Z_().uuid().safeParse(r):null,c=a?.trim()??"";if(!o?.success||c.length<1)return s.NextResponse.json({message:"channelId와 검색어(q)가 필요합니다."},{status:400});let m=await u.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[t.sub,o.data]);if(!m.rows[0]?.ok)return s.NextResponse.json({message:"접근할 수 없습니다."},{status:403});let p=`%${c.replace(/%/g,"\\%").replace(/_/g,"\\_")}%`,l=await u.db.query(`
    SELECT m.id::text, m.body, m.created_at, u.name AS user_name
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = $1::uuid
      AND m.parent_message_id IS NULL
      AND m.deleted_at IS NULL
      AND m.body ILIKE $2 ESCAPE '\\'
    ORDER BY m.created_at DESC
    LIMIT 50
    `,[o.data,p]);return s.NextResponse.json({results:l.rows.map(e=>({id:e.id,body:e.body,createdAt:e.created_at.toISOString(),userName:e.user_name}))})}u=(o.then?(await o)():o)[0],a()}catch(e){a(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>a});let a=`
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
`},1923:(e,t,r)=>{r.d(t,{S:()=>s,l:()=>a});let a="auth_token",s="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>u});var s=r(8678),n=e([s]);s=(n.then?(await n)():n)[0];let u=global.__pgPool??new s.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>u});var a=r(41482),s=r.n(a),n=r(1923);function u(e){let t=e.cookies.get(n.l)?.value;return t?function(e){try{let t=s().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>r(21398));module.exports=a})();