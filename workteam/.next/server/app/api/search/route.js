"use strict";(()=>{var e={};e.id=280,e.ids=[280],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},41562:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.r(t),a.d(t,{originalPathname:()=>E,patchFetch:()=>u,requestAsyncStorage:()=>p,routeModule:()=>m,serverHooks:()=>l,staticGenerationAsyncStorage:()=>c});var d=a(49303),r=a(88716),i=a(60670),s=a(28915),o=e([s]);s=(o.then?(await o)():o)[0];let m=new d.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/search/route",pathname:"/api/search",filename:"route",bundlePath:"app/api/search/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\search\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:c,serverHooks:l}=m,E="/api/search/route";function u(){return(0,i.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:c})}n()}catch(e){n(e)}})},28915:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.r(t),a.d(t,{GET:()=>E});var d=a(87070),r=a(91585),i=a(75748),s=a(23016),o=a(27754),u=a(61165),m=a(91978),p=e([i,o,m]);[i,o,m]=p.then?(await p)():p;let _=r.Ry({q:r.Z_().trim().min(1).max(200),type:r.Km(["all","chat","task","note","event","file"]).optional().default("all")});function c(e,t=140){let a=e.replace(/\u200b/g,"").trim();return a.length<=t?a:`${a.slice(0,t)}…`}function l(e,t,a){console.error(`[GET /api/search] ${e} failed`,{...a??{},error:t instanceof Error?{message:t.message,stack:t.stack}:t})}async function E(e){let t;let a=(0,u.v6)(e);if(!a)return d.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let n=_.safeParse({q:e.nextUrl.searchParams.get("q")??"",type:e.nextUrl.searchParams.get("type")??void 0});if(!n.success)return d.NextResponse.json({message:"검색어(q)가 필요합니다."},{status:400});try{t=await (0,m.r)(a.sub)}catch(e){return l("user-context",e,{userId:a.sub}),d.NextResponse.json({message:"사용자 정보를 불러오지 못했습니다."},{status:500})}if(!t)return d.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let r=t,p=n.data.q,E=n.data.type,N=`%${p.replace(/%/g,"\\%").replace(/_/g,"\\_")}%`,I=[];try{I="admin"===r.role?[]:await (0,o.J)(r),console.info("[GET /api/search] scope resolved",{userId:r.id,role:r.role,departmentCount:r.departments.length,scopeCount:I.length,type:E,q:p})}catch(e){l("scope",e,{userId:r.id,role:r.role,type:E,q:p}),I="admin"===r.role?[]:r.departments.map(e=>e.id)}let R=[];async function S(){for(let e of(await i.db.query(`
      SELECT
        'chat'::text AS category,
        m.id::text AS id,
        m.channel_id::text AS channel_id,
        c.name AS title,
        m.body AS snippet,
        c.department_id::text AS department_id,
        d.name AS department_name,
        m.created_at AS occurred_at
      FROM messages m
      INNER JOIN channels c ON c.id = m.channel_id
      LEFT JOIN departments d ON d.id = c.department_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE ${s.F}
        AND m.deleted_at IS NULL
        AND m.parent_message_id IS NULL
        AND (
          c.name ILIKE $2 ESCAPE '\\'
          OR m.body ILIKE $2 ESCAPE '\\'
        )
      ORDER BY m.created_at DESC
      LIMIT 20
      `,[r.id,N])).rows)R.push({category:"chat",id:e.id,title:e.title,snippet:e.snippet?c(e.snippet):null,departmentId:e.department_id,departmentName:e.department_name,occurredAt:e.occurred_at.toISOString(),link:`/chat?channelId=${encodeURIComponent(e.channel_id)}&focusMessageId=${encodeURIComponent(e.id)}`})}async function O(){for(let e of(await i.db.query(`
      SELECT
        t.id::text,
        t.title,
        t.description,
        t.department_id::text,
        d.name AS department_name,
        t.updated_at
      FROM tasks t
      LEFT JOIN departments d ON d.id = t.department_id
      WHERE (
        t.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(t.description, '') ILIKE $1 ESCAPE '\\'
      )
      AND (
        $2::text = 'admin'
        OR (
          (t.department_id IS NOT NULL AND t.department_id = ANY($3::uuid[]))
          OR (t.department_id IS NULL AND t.created_by = $4::uuid)
        )
      )
      ORDER BY t.updated_at DESC
      LIMIT 20
      `,[N,r.role,I,r.id])).rows)R.push({category:"task",id:e.id,title:e.title,snippet:e.description?c(e.description):null,departmentId:e.department_id,departmentName:e.department_name,occurredAt:e.updated_at.toISOString(),link:"/tasks"})}async function y(){for(let e of(await i.db.query(`
      WITH note_text AS (
        SELECT
          n.id,
          n.title,
          n.department_id,
          n.updated_at,
          (
            SELECT STRING_AGG(COALESCE(nb.body, ''), ' ' ORDER BY nb.sort_order ASC)
            FROM note_blocks nb
            WHERE nb.note_id = n.id
          ) AS body
        FROM meeting_notes n
      )
      SELECT
        nt.id::text,
        nt.title,
        nt.body,
        nt.department_id::text,
        d.name AS department_name,
        nt.updated_at
      FROM note_text nt
      INNER JOIN departments d ON d.id = nt.department_id
      WHERE (
        nt.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(nt.body, '') ILIKE $1 ESCAPE '\\'
      )
      AND ($2::text = 'admin' OR nt.department_id = ANY($3::uuid[]))
      ORDER BY nt.updated_at DESC
      LIMIT 20
      `,[N,r.role,I])).rows)R.push({category:"note",id:e.id,title:e.title,snippet:e.body?c(e.body):null,departmentId:e.department_id,departmentName:e.department_name,occurredAt:e.updated_at.toISOString(),link:`/meeting-notes?id=${encodeURIComponent(e.id)}`})}async function A(){for(let e of(await i.db.query(`
      SELECT
        e.id::text,
        e.title,
        e.description,
        e.department_id::text,
        d.name AS department_name,
        e.starts_at,
        e.kind,
        e.created_by,
        e.attendee_user_ids
      FROM events e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE (
        e.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(e.description, '') ILIKE $1 ESCAPE '\\'
      )
      AND (
        $2::text = 'admin'
        OR (
          e.kind = 'announcement'
          OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
          OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($4::uuid[]))
        )
      )
      ORDER BY e.starts_at DESC
      LIMIT 20
      `,[N,r.role,r.id,I])).rows)R.push({category:"event",id:e.id,title:e.title,snippet:e.description?c(e.description):null,departmentId:e.department_id,departmentName:e.department_name,occurredAt:e.starts_at.toISOString(),link:"/calendar"})}async function f(){for(let e of(await i.db.query(`
      SELECT
        fa.id::text,
        fa.original_name,
        fa.entity_type,
        fa.entity_id::text,
        dept.department_id::text AS department_id,
        d.name AS department_name,
        fa.created_at
      FROM file_attachments fa
      LEFT JOIN LATERAL (
        SELECT t.department_id
        FROM tasks t
        WHERE fa.entity_type = 'task' AND t.id = fa.entity_id
        UNION ALL
        SELECT n.department_id
        FROM meeting_notes n
        WHERE fa.entity_type = 'meeting_note' AND n.id = fa.entity_id
        UNION ALL
        SELECT c.department_id
        FROM messages m
        INNER JOIN channels c ON c.id = m.channel_id
        INNER JOIN users u ON u.id = $1::uuid
        WHERE fa.entity_type = 'chat_message'
          AND m.id = fa.entity_id
          AND ${s.F}
        LIMIT 1
      ) dept ON TRUE
      LEFT JOIN departments d ON d.id = dept.department_id
      WHERE fa.original_name ILIKE $2 ESCAPE '\\'
        AND (
          $3::text = 'admin'
          OR dept.department_id = ANY($4::uuid[])
          OR (dept.department_id IS NULL AND fa.uploaded_by = $1::uuid)
        )
      ORDER BY fa.created_at DESC
      LIMIT 20
      `,[r.id,N,r.role,I])).rows){let t="task"===e.entity_type?"/tasks":"meeting_note"===e.entity_type?`/meeting-notes?id=${encodeURIComponent(e.entity_id)}`:"/chat";R.push({category:"file",id:e.id,title:e.original_name,snippet:null,departmentId:e.department_id,departmentName:e.department_name,occurredAt:e.created_at.toISOString(),link:t})}}async function L(e,t){try{await t()}catch(t){l(e,t,{userId:r.id,role:r.role,scopeCount:I.length,q:p})}}return("all"===E||"chat"===E)&&await L("chat",S),("all"===E||"task"===E)&&await L("task",O),("all"===E||"note"===E)&&await L("note",y),("all"===E||"event"===E)&&await L("event",A),("all"===E||"file"===E)&&await L("file",f),R.sort((e,t)=>t.occurredAt.localeCompare(e.occurredAt)),d.NextResponse.json({items:R.slice(0,80)})}n()}catch(e){n(e)}})},23016:(e,t,a)=>{a.d(t,{F:()=>n});let n=`
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
`},1923:(e,t,a)=>{a.d(t,{S:()=>d,l:()=>n});let n="auth_token",d="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.d(t,{db:()=>i});var d=a(8678),r=e([d]);d=(r.then?(await r)():r)[0];let i=global.__pgPool??new d.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});n()}catch(e){n(e)}})},27754:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.d(t,{J:()=>i,d:()=>s});var d=a(75748),r=e([d]);async function i(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let a=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),n=new Set(t);if(0===a.length)return[...n];for(let e of(await d.db.query(`
    WITH RECURSIVE sub AS (
      SELECT id
      FROM departments
      WHERE id = ANY($1::uuid[])
      UNION ALL
      SELECT d.id
      FROM departments d
      INNER JOIN sub ON d.parent_id = sub.id
    )
    SELECT DISTINCT id::text FROM sub
    `,[a])).rows)n.add(e.id);return[...n]}async function s(e,t){return"admin"===e.role||!!t&&(await i(e)).includes(t)}d=(r.then?(await r)():r)[0],n()}catch(e){n(e)}})},61165:(e,t,a)=>{a.d(t,{v6:()=>i});var n=a(41482),d=a.n(n),r=a(1923);function i(e){let t=e.cookies.get(r.l)?.value;return t?function(e){try{let t=d().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.d(t,{r:()=>s});var d=a(75748),r=a(74034),i=e([d,r]);async function s(e){if(!e||"undefined"===e)return null;let t=(await d.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let a=await (0,r.Z)(e),n=a.find(e=>e.isPrimary)??a[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:n?.departmentId??null,departmentName:n?.departmentName??null,departments:a.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[d,r]=i.then?(await i)():i,n()}catch(e){n(e)}})},74034:(e,t,a)=>{a.a(e,async(e,n)=>{try{a.d(t,{Z:()=>i});var d=a(75748),r=e([d]);async function i(e){return(await d.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}d=(r.then?(await r)():r)[0],n()}catch(e){n(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),n=t.X(0,[9276,5972,1482,1585],()=>a(41562));module.exports=n})();