"use strict";(()=>{var e={};e.id=9402,e.ids=[9402],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},20629:e=>{e.exports=require("fs/promises")},55315:e=>{e.exports=require("path")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},13109:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>m,serverHooks:()=>_,staticGenerationAsyncStorage:()=>c});var s=a(49303),n=a(88716),r=a(60670),d=a(7058),u=e([d]);d=(u.then?(await u)():u)[0];let m=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/chat/messages/route",pathname:"/api/chat/messages",filename:"route",bundlePath:"app/api/chat/messages/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\messages\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:_}=m,p="/api/chat/messages/route";function o(){return(0,r.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:c})}i()}catch(e){i(e)}})},7058:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{GET:()=>f,POST:()=>R});var s=a(87070),n=a(91585),r=a(75748),d=a(23016),u=a(84995),o=a(37014),m=a(22908),l=a(95698),c=a(20940),_=a(14123),p=a(61165),y=e([r,u,o,_]);[r,u,o,_]=y.then?(await y)():y;let N=n.Z_().uuid();async function g(e,t){let a=await r.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid
      AND ${d.F}
    LIMIT 1
    `,[e,t]);return!!a.rows[0]?.ok}async function E(e,t){let a=e.map(e=>e.id),i=await (0,u.$2)(a,t),s=await (0,o.yg)(a);return e.map(e=>(0,u.Fz)(e,i.get(e.id)??[],s.get(e.id)??[]))}async function f(e){let t=(0,p.v6)(e);if(!t)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=e.nextUrl.searchParams.get("channelId"),i=e.nextUrl.searchParams.get("threadRootId"),n=e.nextUrl.searchParams.get("aroundMessageId"),d=a?N.safeParse(a):null;if(!d?.success)return s.NextResponse.json({message:"channelId가 필요합니다."},{status:400});if(!await g(t.sub,d.data))return s.NextResponse.json({message:"채널에 접근할 수 없습니다."},{status:403});if(i){let e=N.safeParse(i);if(!e.success)return s.NextResponse.json({message:"threadRootId가 올바르지 않습니다."},{status:400});let a=await r.db.query(`
      SELECT
        m.id,
        m.channel_id::text,
        m.user_id::text,
        m.parent_message_id::text,
        m.body,
        m.created_at,
        m.edited_at,
        m.deleted_at,
        u.name AS user_name,
        u.email AS user_email
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = $1::uuid
        AND (m.id = $2::uuid OR m.parent_message_id = $2::uuid)
      ORDER BY m.created_at ASC
      `,[d.data,e.data]),n=await E(a.rows,t.sub);return s.NextResponse.json({messages:n})}if(n){let e=N.safeParse(n);if(!e.success)return s.NextResponse.json({message:"aroundMessageId가 올바르지 않습니다."},{status:400});let a=(await r.db.query(`
      SELECT id::text, created_at, parent_message_id::text
      FROM messages
      WHERE id = $1::uuid AND channel_id = $2::uuid AND deleted_at IS NULL
      LIMIT 1
      `,[e.data,d.data])).rows[0];if(!a)return s.NextResponse.json({message:"대상 메시지를 찾을 수 없습니다."},{status:404});if(a.parent_message_id)return s.NextResponse.json({message:"스레드 답글 점프는 아직 지원하지 않습니다."},{status:400});let i=await r.db.query(`
      WITH target AS (
        SELECT $1::uuid AS id, $2::timestamptz AS created_at
      ),
      before AS (
        SELECT
          m.id,
          m.channel_id::text,
          m.user_id::text,
          m.parent_message_id::text,
          m.body,
          m.created_at,
          m.edited_at,
          m.deleted_at,
          u.name AS user_name,
          u.email AS user_email
        FROM messages m
        JOIN users u ON u.id = m.user_id
        JOIN target t ON TRUE
        WHERE m.channel_id = $3::uuid
          AND m.parent_message_id IS NULL
          AND m.deleted_at IS NULL
          AND (m.created_at < t.created_at OR (m.created_at = t.created_at AND m.id <= t.id))
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $4
      ),
      after AS (
        SELECT
          m.id,
          m.channel_id::text,
          m.user_id::text,
          m.parent_message_id::text,
          m.body,
          m.created_at,
          m.edited_at,
          m.deleted_at,
          u.name AS user_name,
          u.email AS user_email
        FROM messages m
        JOIN users u ON u.id = m.user_id
        JOIN target t ON TRUE
        WHERE m.channel_id = $3::uuid
          AND m.parent_message_id IS NULL
          AND m.deleted_at IS NULL
          AND (m.created_at > t.created_at OR (m.created_at = t.created_at AND m.id > t.id))
        ORDER BY m.created_at ASC, m.id ASC
        LIMIT $5
      )
      SELECT * FROM (
        SELECT * FROM before
        UNION ALL
        SELECT * FROM after
      ) x
      ORDER BY x.created_at ASC, x.id ASC
      `,[e.data,a.created_at,d.data,31,30]),u=await E(i.rows,t.sub);return s.NextResponse.json({messages:u,focusMessageId:e.data})}let u=await r.db.query(`
    SELECT
      m.id,
      m.channel_id::text,
      m.user_id::text,
      m.parent_message_id::text,
      m.body,
      m.created_at,
      m.edited_at,
      m.deleted_at,
      u.name AS user_name,
      u.email AS user_email
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = $1::uuid AND m.parent_message_id IS NULL
    ORDER BY m.created_at ASC
    `,[d.data]),o=await E(u.rows,t.sub);return s.NextResponse.json({messages:o})}async function R(e){let t;let a=(0,p.v6)(e);if(!a)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});if(!(e.headers.get("content-type")??"").includes("multipart/form-data"))return s.NextResponse.json({message:"multipart/form-data가 필요합니다."},{status:400});try{t=await e.formData()}catch{return s.NextResponse.json({message:"본문을 읽을 수 없습니다."},{status:400})}let i=String(t.get("channelId")??"").trim(),n=String(t.get("body")??"").trim(),d=t.get("parentMessageId"),y="string"==typeof d&&d.trim()?d.trim():null,E=t.getAll("files").filter(e=>e instanceof File&&e.size>0);if(!N.safeParse(i).success)return s.NextResponse.json({message:"channelId가 올바르지 않습니다."},{status:400});if(!n&&0===E.length)return s.NextResponse.json({message:"메시지 또는 파일이 필요합니다."},{status:400});if(n.length>1e4)return s.NextResponse.json({message:"메시지가 너무 깁니다."},{status:400});if(!await g(a.sub,i))return s.NextResponse.json({message:"채널에 접근할 수 없습니다."},{status:403});let f=(await r.db.query("SELECT name, department_id::text FROM channels WHERE id = $1::uuid LIMIT 1",[i])).rows[0];if(!n&&E.length>0&&(n="​"),y){let e=N.safeParse(y);if(!e.success)return s.NextResponse.json({message:"thread가 올바르지 않습니다."},{status:400});let t=(await r.db.query("SELECT channel_id::text FROM messages WHERE id = $1::uuid LIMIT 1",[e.data])).rows[0];if(!t||t.channel_id!==i)return s.NextResponse.json({message:"스레드 메시지가 올바르지 않습니다."},{status:400})}let R=(await r.db.query(`
    INSERT INTO messages (channel_id, user_id, parent_message_id, body)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
    RETURNING id::text
    `,[i,a.sub,y,n])).rows[0].id;try{for(let e of E){let t=Buffer.from(await e.arrayBuffer());if(""===(0,l.q5)(e.name))throw Error("bad_ext");let i=await (0,l.D0)(t,e.name),s=await (0,o.zx)({entityType:"chat_message",entityId:R,uploadedBy:a.sub,originalName:e.name,storageKey:i.storageKey,mimeType:i.mimeType,byteSize:i.byteSize});await (0,_.v)({userId:a.sub,actionType:"file_uploaded",entityType:"file",entityId:s.id,entityName:e.name,departmentId:f?.department_id??null,metadata:{parentEntityType:"chat_message",parentEntityId:R,parentEntityName:f?.name??"채널",url:"/chat"}})}}catch(t){await r.db.query("DELETE FROM messages WHERE id = $1::uuid",[R]);let e=t instanceof Error?t.message:"";if("bad_ext"===e||"unsupported_type"===e||"too_large"===e)return s.NextResponse.json({message:"파일을 첨부할 수 없습니다."},{status:400});return console.error("[POST chat/messages]",t),s.NextResponse.json({message:"첨부 저장에 실패했습니다."},{status:500})}let h=(await r.db.query(`
    SELECT
      m.id,
      m.channel_id::text,
      m.user_id::text,
      m.parent_message_id::text,
      m.body,
      m.created_at,
      m.edited_at,
      m.deleted_at,
      u.name AS user_name,
      u.email AS user_email
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = $1::uuid
    `,[R])).rows[0];if(!h)return s.NextResponse.json({message:"저장 후 조회에 실패했습니다."},{status:500});let x=await (0,u.$2)([R],a.sub),S=await (0,u.tq)(h,x.get(R)??[],a.sub),I=f?.name!=null?String(f.name).replace(/^#\s*/,"").trim():"채팅",w={...S,channelDisplayName:I};return(0,m.I)(S.channelId,"chat:message",w),(0,c.CK)({channelId:S.channelId,channelDisplayName:I,senderName:S.userName,bodyPreview:String(S.body??"").replace(/\u200b/g,"").trim().slice(0,50),authorUserId:S.userId,messageId:S.id,parentMessageId:S.parentMessageId}),(0,c.h0)(),await (0,_.v)({userId:a.sub,actionType:"message_sent",entityType:"channel",entityId:i,entityName:f?.name??"채널",departmentId:f?.department_id??null,metadata:{messageId:R,parentMessageId:y,hasAttachment:E.length>0,url:"/chat"}}),s.NextResponse.json({message:S})}i()}catch(e){i(e)}})},14123:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{v:()=>u});var s=a(75748),n=a(20940),r=e([s]);async function d(e){let{userId:t,actionType:a,entityType:i,entityId:r,entityName:d,departmentId:u=null,metadata:o={}}=e,m=await s.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[t,a,i,r,d,u,JSON.stringify(o)]);(0,n.yS)("activity:new",{id:m.rows[0]?.id??null})}async function u(e){try{await d(e)}catch(e){console.error("[activity-log]",e)}}s=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})},20940:(e,t,a)=>{function i(e,t){let a=globalThis.__activityIoBroadcast;try{a?.(e,t)}catch{}}function s(){i("nav:badges",{})}function n(e){i("chat:notify",e)}a.d(t,{CK:()=>n,h0:()=>s,yS:()=>i})},23016:(e,t,a)=>{a.d(t,{F:()=>i});let i=`
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
`},84995:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{$2:()=>d,Fz:()=>u,tq:()=>o});var s=a(75748),n=a(37014),r=e([s,n]);async function d(e,t){let a=new Map;if(0===e.length)return a;for(let i of(await s.db.query(`
    SELECT
      message_id::text,
      emoji,
      COUNT(*)::text AS cnt,
      BOOL_OR(user_id = $1::uuid) AS self
    FROM message_reactions
    WHERE message_id = ANY($2::uuid[])
    GROUP BY message_id, emoji
    ORDER BY emoji
    `,[t,e])).rows){let e=a.get(i.message_id)??[];e.push({emoji:i.emoji,count:Number(i.cnt),self:i.self}),a.set(i.message_id,e)}return a}function u(e,t,a=[]){return{id:e.id,channelId:e.channel_id,userId:e.user_id,parentMessageId:e.parent_message_id,body:e.body,createdAt:e.created_at.toISOString(),editedAt:e.edited_at?e.edited_at.toISOString():null,deletedAt:e.deleted_at?e.deleted_at.toISOString():null,userName:e.user_name,userEmail:e.user_email,reactions:t,attachments:a}}async function o(e,t,a){let i=await (0,n.yg)([e.id]);return u(e,t,i.get(e.id)??[])}[s,n]=r.then?(await r)():r,i()}catch(e){i(e)}})},22908:(e,t,a)=>{a.d(t,{I:()=>i});function i(e,t,a){let i=globalThis.__chatIoBroadcast;try{i?.(e,t,a)}catch{}}},1923:(e,t,a)=>{a.d(t,{S:()=>s,l:()=>i});let i="auth_token",s="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{db:()=>r});var s=a(8678),n=e([s]);s=(n.then?(await n)():n)[0];let r=global.__pgPool??new s.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});i()}catch(e){i(e)}})},37014:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Gd:()=>d,Gf:()=>l,cB:()=>c,ev:()=>u,fA:()=>_,yg:()=>o,zx:()=>m});var s=a(75748),n=a(65465),r=e([s,n]);function d(e){let t=e.mime_type.startsWith("image/"),a=(0,n.K5)(e);return{id:e.id,originalName:e.original_name,mimeType:e.mime_type,byteSize:Number(e.byte_size),url:`/api/files/${e.id}`,previewUrl:t&&!a?`/api/files/${e.id}?inline=1`:null,isImage:t,expired:!!a||void 0}}async function u(e,t){return(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    ORDER BY created_at ASC
    `,[e,t])).rows.map(d)}async function o(e){let t=new Map;if(0===e.length)return t;for(let a of(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = 'chat_message' AND entity_id = ANY($1::uuid[])
    ORDER BY created_at ASC
    `,[e])).rows){let e=a.entity_id,i=d(a),s=t.get(e)??[];s.push(i),t.set(e,s)}return t}async function m(e){return(await s.db.query(`
    INSERT INTO file_attachments (
      entity_type, entity_id, uploaded_by, original_name, storage_key, mime_type, byte_size
    )
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7)
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e.entityType,e.entityId,e.uploadedBy,e.originalName,e.storageKey,e.mimeType,e.byteSize])).rows[0]}async function l(e){return(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE id = $1::uuid
    LIMIT 1
    `,[e])).rows[0]??null}async function c(e){return(await s.db.query(`
    DELETE FROM file_attachments
    WHERE id = $1::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e])).rows[0]??null}async function _(e,t){return(await s.db.query(`
    DELETE FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[e,t])).rows}[s,n]=r.then?(await r)():r,i()}catch(e){i(e)}})},65465:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Hw:()=>o,K5:()=>u});var s=a(75748),n=a(95698),r=e([s]);function d(){let e=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(e)&&e>0?e:30}function u(e){var t;if(t=e.entity_type,"chat_message"!==t&&"task"!==t)return!1;let a=d(),i=new Date(e.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function o(){let e=d(),t=await s.db.connect(),a=0,i=[];try{await t.query("BEGIN");let s=await t.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[e]);if(0===s.rows.length)return await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await t.query("COMMIT"),{filesDeleted:0};let n=s.rows.map(e=>e.id),r=await t.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[n]);for(let e of(a=r.rows.length,r.rows))i.push(e.storage_key);await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await t.query("COMMIT")}catch(e){try{await t.query("ROLLBACK")}catch{}throw e}finally{t.release()}return await Promise.all(i.map(e=>(0,n.Yy)(e))),{filesDeleted:a}}s=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})},95698:(e,t,a)=>{a.d(t,{D0:()=>c,Yy:()=>_,fu:()=>p,q5:()=>l});var i=a(84770),s=a(20629),n=a.n(s),r=a(55315),d=a.n(r);let u=d().join(process.cwd(),"storage","uploads"),o=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),m={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function l(e){let t=d().basename(e),a=t.lastIndexOf(".");return -1===a?"":t.slice(a+1).toLowerCase()}async function c(e,t){let a=l(t);if(!a||!o.has(a))throw Error("unsupported_type");if(e.length>26214400)throw Error("too_large");let s=m[a.toLowerCase()]??"application/octet-stream",r=new Date,c=d().join(String(r.getFullYear()),String(r.getMonth()+1).padStart(2,"0")),_=d().join(u,c);await n().mkdir(_,{recursive:!0});let p=d().basename(t).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),y=`${(0,i.randomUUID)()}_${p||`file.${a}`}`,g=d().join(_,y);return await n().writeFile(g,e),{storageKey:d().join(c,y).replace(/\\/g,"/"),mimeType:s,byteSize:e.length}}async function _(e){let t=d().join(u,e),a=d().normalize(t);if(!a.startsWith(d().normalize(u)))throw Error("invalid_path");await n().unlink(a).catch(()=>void 0)}function p(e){return d().join(u,e)}},61165:(e,t,a)=>{a.d(t,{v6:()=>r});var i=a(41482),s=a.n(i),n=a(1923);function r(e){let t=e.cookies.get(n.l)?.value;return t?function(e){try{let t=s().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[9276,5972,1482,1585],()=>a(13109));module.exports=i})();