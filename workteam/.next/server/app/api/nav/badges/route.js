"use strict";(()=>{var e={};e.id=3126,e.ids=[3126],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},6282:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>p,patchFetch:()=>m,requestAsyncStorage:()=>E,routeModule:()=>o,serverHooks:()=>l,staticGenerationAsyncStorage:()=>_});var d=r(49303),u=r(88716),n=r(60670),i=r(41898),s=e([i]);i=(s.then?(await s)():s)[0];let o=new d.AppRouteRouteModule({definition:{kind:u.x.APP_ROUTE,page:"/api/nav/badges/route",pathname:"/api/nav/badges",filename:"route",bundlePath:"app/api/nav/badges/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\nav\\badges\\route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:E,staticGenerationAsyncStorage:_,serverHooks:l}=o,p="/api/nav/badges/route";function m(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:_})}a()}catch(e){a(e)}})},41898:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>E});var d=r(87070),u=r(75748),n=r(23016),i=r(27754),s=r(61165),m=r(91978),o=e([u,i,m]);async function E(e){let t=(0,s.v6)(e);if(!t)return d.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,m.r)(t.sub);if(!r)return d.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let a=await u.db.query(`
    SELECT COALESCE(SUM(sub.unread)::text, '0') AS n
    FROM (
      SELECT COALESCE(
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
      ) AS unread
      FROM channels c
      INNER JOIN users u ON u.id = $1::uuid
      LEFT JOIN channel_reads cr ON cr.channel_id = c.id AND cr.user_id = $1::uuid
      WHERE ${n.F}
    ) sub
    `,[t.sub]),o=Number.parseInt(a.rows[0]?.n??"0",10)||0,E=`
    SELECT COUNT(*)::int AS n
    FROM tasks t
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $1::uuid
    WHERE t.assignee_user_id = $1::uuid
      AND t.status <> 'done'
      AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
  `,_=[t.sub];if("admin"!==r.role){let e=await (0,i.J)(r);E+=` AND (
      (t.department_id IS NOT NULL AND t.department_id = ANY($2::uuid[]))
      OR (t.department_id IS NULL AND t.created_by = $1::uuid)
    )`,_.push(e)}let l=await u.db.query(E,_),p=l.rows[0]?.n??0,{todayStart:N,tomorrow:c}=function(){let e=new Date;e.setUTCHours(0,0,0,0);let t=new Date(e);return t.setUTCDate(t.getUTCDate()+1),{todayStart:e,tomorrow:t}}(),R=new Date().toISOString(),S=`
    SELECT COUNT(*)::int AS n
    FROM events e
    WHERE e.starts_at < $1::timestamptz
      AND e.ends_at > $2::timestamptz
      AND e.ends_at > $3::timestamptz
      AND (
        NOT EXISTS (
          SELECT 1 FROM user_badge_reads ubr
          WHERE ubr.user_id = $4::uuid AND ubr.badge_type = 'calendar'
        )
        OR EXISTS (
          SELECT 1 FROM user_badge_reads ubr
          WHERE ubr.user_id = $4::uuid AND ubr.badge_type = 'calendar'
          AND (e.updated_at > ubr.last_read_at OR e.created_at > ubr.last_read_at)
        )
      )
  `,O=[c.toISOString(),N.toISOString(),R,t.sub];if("admin"===r.role)S+=` AND (
      e.kind = 'announcement'
      OR (e.kind = 'personal' AND (e.created_by = $5::uuid OR $5::uuid = ANY(e.attendee_user_ids)))
      OR (e.kind = 'team')
    )`,O.push(r.id);else{let e=await (0,i.J)(r);S+=` AND (
      e.kind = 'announcement'
      OR (e.kind = 'personal' AND (e.created_by = $5::uuid OR $5::uuid = ANY(e.attendee_user_ids)))
      OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($6::uuid[]))
    )`,O.push(r.id,e)}let b=await u.db.query(S,O),A=b.rows[0]?.n??0,T=0;if("admin"===r.role){let e=await u.db.query(`
      SELECT COUNT(*)::text AS n
      FROM meeting_notes n
      WHERE n.updated_at > COALESCE(
        (SELECT ubr.last_read_at FROM user_badge_reads ubr
         WHERE ubr.user_id = $1::uuid AND ubr.badge_type = 'notes' LIMIT 1),
        NOW() - INTERVAL '30 days'
      )
      `,[t.sub]);T=Number.parseInt(e.rows[0]?.n??"0",10)||0}else{let e=await (0,i.J)(r);if(e.length>0){let r=await u.db.query(`
        SELECT COUNT(*)::text AS n
        FROM meeting_notes n
        WHERE n.department_id = ANY($1::uuid[])
          AND n.updated_at > COALESCE(
            (SELECT ubr.last_read_at FROM user_badge_reads ubr
             WHERE ubr.user_id = $2::uuid AND ubr.badge_type = 'notes' LIMIT 1),
            NOW() - INTERVAL '30 days'
          )
        `,[e,t.sub]);T=Number.parseInt(r.rows[0]?.n??"0",10)||0}}let L=["al.created_at > COALESCE((SELECT ubr.last_read_at FROM user_badge_reads ubr WHERE ubr.user_id = $1::uuid AND ubr.badge_type = 'activity' LIMIT 1), NOW() - INTERVAL '14 days')","al.user_id <> $1::uuid"],I=[t.sub],y=2;if("admin"!==r.role){let e=await (0,i.J)(r);L.push(`(al.department_id = ANY($${y}::uuid[]) OR (al.department_id IS NULL AND al.user_id = $${y+1}::uuid))`),I.push(e,r.id),y+=2}let C=await u.db.query(`
    SELECT COUNT(*)::text AS n
    FROM activity_logs al
    WHERE ${L.join(" AND ")}
    `,I),g=Number.parseInt(C.rows[0]?.n??"0",10)||0;return d.NextResponse.json({chatUnread:o,tasksMineOpen:p,calendarTodayRemaining:A,meetingNotesNew:T,activityNew:g})}[u,i,m]=o.then?(await o)():o,a()}catch(e){a(e)}})},23016:(e,t,r)=>{r.d(t,{F:()=>a});let a=`
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
`},1923:(e,t,r)=>{r.d(t,{S:()=>d,l:()=>a});let a="auth_token",d="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>n});var d=r(8678),u=e([d]);d=(u.then?(await u)():u)[0];let n=global.__pgPool??new d.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{J:()=>n,d:()=>i});var d=r(75748),u=e([d]);async function n(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let r=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===r.length)return[...a];for(let e of(await d.db.query(`
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
    `,[r])).rows)a.add(e.id);return[...a]}async function i(e,t){return"admin"===e.role||!!t&&(await n(e)).includes(t)}d=(u.then?(await u)():u)[0],a()}catch(e){a(e)}})},61165:(e,t,r)=>{r.d(t,{v6:()=>n});var a=r(41482),d=r.n(a),u=r(1923);function n(e){let t=e.cookies.get(u.l)?.value;return t?function(e){try{let t=d().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>i});var d=r(75748),u=r(74034),n=e([d,u]);async function i(e){if(!e||"undefined"===e)return null;let t=(await d.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,u.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[d,u]=n.then?(await n)():n,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>n});var d=r(75748),u=e([d]);async function n(e){return(await d.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}d=(u.then?(await u)():u)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482],()=>r(6282));module.exports=a})();