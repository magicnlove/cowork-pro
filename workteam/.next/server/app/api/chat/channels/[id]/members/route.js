"use strict";(()=>{var e={};e.id=9305,e.ids=[9305],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},59103:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.r(r),t.d(r,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>c,routeModule:()=>m,serverHooks:()=>p,staticGenerationAsyncStorage:()=>l});var n=t(49303),s=t(88716),u=t(60670),i=t(95722),d=e([i]);i=(d.then?(await d)():d)[0];let m=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/chat/channels/[id]/members/route",pathname:"/api/chat/channels/[id]/members",filename:"route",bundlePath:"app/api/chat/channels/[id]/members/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\channels\\[id]\\members\\route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:c,staticGenerationAsyncStorage:l,serverHooks:p}=m,E="/api/chat/channels/[id]/members/route";function o(){return(0,u.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:l})}a()}catch(e){a(e)}})},95722:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.r(r),t.d(r,{GET:()=>l,PATCH:()=>p});var n=t(87070),s=t(91585),u=t(75748),i=t(56039),d=t(23016),o=t(61165),m=t(91978),c=e([u,i,m]);[u,i,m]=c.then?(await c)():c;let E=s.Ry({addUserIds:s.IX(s.Z_().uuid()).max(30).optional(),removeUserIds:s.IX(s.Z_().uuid()).max(30).optional()});async function l(e,r){let t=(0,o.v6)(e);if(!t)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:a}=r.params,s=await u.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[a]),i=s.rows[0]?.kind;if(!i||"group_dm"!==i&&"cross_team"!==i)return n.NextResponse.json({message:"멤버 목록이 없는 채널입니다."},{status:400});let m=await u.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[t.sub,a]);if(!m.rows[0]?.ok)return n.NextResponse.json({message:"접근할 수 없습니다."},{status:403});let c=await u.db.query(`
    SELECT u.id::text, u.name, u.email, cm.role
    FROM channel_members cm
    INNER JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = $1::uuid
    ORDER BY
      CASE cm.role WHEN 'host' THEN 0 ELSE 1 END,
      u.name ASC
    `,[a]);return n.NextResponse.json({members:c.rows.map(e=>({id:e.id,name:e.name,email:e.email,role:e.role}))})}async function p(e,r){let t;let a=(0,o.v6)(e);if(!a)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let s=await (0,m.r)(a.sub);if(!s)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:c}=r.params,l=await u.db.query("SELECT kind FROM channels WHERE id = $1::uuid",[c]),p=l.rows[0]?.kind;if(!p||"group_dm"!==p&&"cross_team"!==p)return n.NextResponse.json({message:"멤버를 관리할 수 없는 채널입니다."},{status:400});let R=await u.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[a.sub,c]);if(!R.rows[0]?.ok)return n.NextResponse.json({message:"접근할 수 없습니다."},{status:403});if(!("admin"===s.role||"manager"===s.role||await (0,i.B)(a.sub,c)))return n.NextResponse.json({message:"호스트만 멤버를 관리할 수 있습니다."},{status:403});try{t=await e.json()}catch{return n.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let N=E.safeParse(t);if(!N.success)return n.NextResponse.json({message:"입력이 올바르지 않습니다."},{status:400});let{addUserIds:_=[],removeUserIds:h=[]}=N.data;if(0===_.length&&0===h.length)return n.NextResponse.json({message:"추가 또는 제거할 사용자가 없습니다."},{status:400});let y=await u.db.connect();try{for(let e of(await y.query("BEGIN"),_))await y.query(`
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, 'member')
        ON CONFLICT (channel_id, user_id) DO NOTHING
        `,[c,e]);for(let e of h){let r=await y.query("SELECT role FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid",[c,e]);if(r.rows[0]?.role==="host")return await y.query("ROLLBACK"),n.NextResponse.json({message:"호스트는 내보낼 수 없습니다."},{status:400});await y.query("DELETE FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid",[c,e])}return await y.query("COMMIT"),n.NextResponse.json({ok:!0})}catch(e){return await y.query("ROLLBACK"),console.error("[PATCH members]",e),n.NextResponse.json({message:"처리하지 못했습니다."},{status:500})}finally{y.release()}}a()}catch(e){a(e)}})},23016:(e,r,t)=>{t.d(r,{F:()=>a});let a=`
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
`},56039:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{B:()=>u,D:()=>i});var n=t(75748),s=e([n]);async function u(e,r){let t=await n.db.query(`
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
    `,[e,r]);return!!t.rows[0]?.ok}async function i(e,r,t){return"admin"===e.role||"manager"===e.role||("cross_team"===t||"group_dm"===t)&&u(e.id,r)}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})},1923:(e,r,t)=>{t.d(r,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{db:()=>u});var n=t(8678),s=e([n]);n=(s.then?(await s)():s)[0];let u=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},61165:(e,r,t)=>{t.d(r,{v6:()=>u});var a=t(41482),n=t.n(a),s=t(1923);function u(e){let r=e.cookies.get(s.l)?.value;return r?function(e){try{let r=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof r&&null!==r&&"sub"in r&&"email"in r)return{sub:String(r.sub),email:String(r.email)};return null}catch{return null}}(r):null}},91978:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{r:()=>i});var n=t(75748),s=t(74034),u=e([n,s]);async function i(e){if(!e||"undefined"===e)return null;let r=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!r)return null;let t=await (0,s.Z)(e),a=t.find(e=>e.isPrimary)??t[0]??null;return{id:r.id,email:r.email,name:r.name,role:r.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:t.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,s]=u.then?(await u)():u,a()}catch(e){a(e)}})},74034:(e,r,t)=>{t.a(e,async(e,a)=>{try{t.d(r,{Z:()=>u});var n=t(75748),s=e([n]);async function u(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var r=require("../../../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[9276,5972,1482,1585],()=>t(59103));module.exports=a})();