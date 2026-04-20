"use strict";(()=>{var e={};e.id=1997,e.ids=[1997],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},20629:e=>{e.exports=require("fs/promises")},55315:e=>{e.exports=require("path")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},79741:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>_,staticGenerationAsyncStorage:()=>c});var s=a(49303),r=a(88716),n=a(60670),d=a(28106),u=e([d]);d=(u.then?(await u)():u)[0];let l=new s.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/chat/messages/[id]/route",pathname:"/api/chat/messages/[id]",filename:"route",bundlePath:"app/api/chat/messages/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\messages\\[id]\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:m,staticGenerationAsyncStorage:c,serverHooks:_}=l,p="/api/chat/messages/[id]/route";function o(){return(0,n.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:c})}i()}catch(e){i(e)}})},28106:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{DELETE:()=>g,PATCH:()=>y});var s=a(87070),r=a(91585),n=a(75748),d=a(23016),u=a(84995),o=a(22908),l=a(37014),m=a(95698),c=a(61165),_=e([n,u,l]);[n,u,l]=_.then?(await _)():_;let E=r.Ry({body:r.Z_().min(1).max(1e4)});async function p(e,t){let a=await n.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${d.F}
    LIMIT 1
    `,[e,t]);return!!a.rows[0]?.ok}async function y(e,t){let a;let i=(0,c.v6)(e);if(!i)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:r}=t.params;try{a=await e.json()}catch{return s.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let d=E.safeParse(a);if(!d.success)return s.NextResponse.json({message:"입력값이 올바르지 않습니다."},{status:400});let l=(await n.db.query("SELECT channel_id::text, user_id::text, deleted_at FROM messages WHERE id = $1::uuid",[r])).rows[0];if(!l)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(l.deleted_at)return s.NextResponse.json({message:"삭제된 메시지는 수정할 수 없습니다."},{status:400});if(l.user_id!==i.sub)return s.NextResponse.json({message:"본인 메시지만 수정할 수 있습니다."},{status:403});if(!await p(i.sub,l.channel_id))return s.NextResponse.json({message:"접근할 수 없습니다."},{status:403});await n.db.query(`
    UPDATE messages
    SET body = $1, edited_at = NOW()
    WHERE id = $2::uuid
    `,[d.data.body,r]);let m=(await n.db.query(`
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
    `,[r])).rows[0],_=await (0,u.$2)([r],i.sub),y=await (0,u.tq)(m,_.get(r)??[],i.sub);return(0,o.I)(y.channelId,"chat:message:update",y),s.NextResponse.json({message:y})}async function g(e,t){let a=(0,c.v6)(e);if(!a)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:i}=t.params,r=(await n.db.query("SELECT channel_id::text, user_id::text, deleted_at FROM messages WHERE id = $1::uuid",[i])).rows[0];if(!r)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(r.deleted_at)return s.NextResponse.json({message:"이미 삭제되었습니다."},{status:400});if(r.user_id!==a.sub)return s.NextResponse.json({message:"본인 메시지만 삭제할 수 있습니다."},{status:403});if(!await p(a.sub,r.channel_id))return s.NextResponse.json({message:"접근할 수 없습니다."},{status:403});for(let e of(await (0,l.fA)("chat_message",i)))await (0,m.Yy)(e.storage_key);await n.db.query("UPDATE messages SET deleted_at = NOW() WHERE id = $1::uuid",[i]);let d=(await n.db.query(`
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
    `,[i])).rows[0],_=await (0,u.$2)([i],a.sub),y=await (0,u.tq)(d,_.get(i)??[],a.sub);return(0,o.I)(y.channelId,"chat:message:update",y),s.NextResponse.json({message:y})}i()}catch(e){i(e)}})},23016:(e,t,a)=>{a.d(t,{F:()=>i});let i=`
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
`},84995:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{$2:()=>d,Fz:()=>u,tq:()=>o});var s=a(75748),r=a(37014),n=e([s,r]);async function d(e,t){let a=new Map;if(0===e.length)return a;for(let i of(await s.db.query(`
    SELECT
      message_id::text,
      emoji,
      COUNT(*)::text AS cnt,
      BOOL_OR(user_id = $1::uuid) AS self
    FROM message_reactions
    WHERE message_id = ANY($2::uuid[])
    GROUP BY message_id, emoji
    ORDER BY emoji
    `,[t,e])).rows){let e=a.get(i.message_id)??[];e.push({emoji:i.emoji,count:Number(i.cnt),self:i.self}),a.set(i.message_id,e)}return a}function u(e,t,a=[]){return{id:e.id,channelId:e.channel_id,userId:e.user_id,parentMessageId:e.parent_message_id,body:e.body,createdAt:e.created_at.toISOString(),editedAt:e.edited_at?e.edited_at.toISOString():null,deletedAt:e.deleted_at?e.deleted_at.toISOString():null,userName:e.user_name,userEmail:e.user_email,reactions:t,attachments:a}}async function o(e,t,a){let i=await (0,r.yg)([e.id]);return u(e,t,i.get(e.id)??[])}[s,r]=n.then?(await n)():n,i()}catch(e){i(e)}})},22908:(e,t,a)=>{a.d(t,{I:()=>i});function i(e,t,a){let i=globalThis.__chatIoBroadcast;try{i?.(e,t,a)}catch{}}},1923:(e,t,a)=>{a.d(t,{S:()=>s,l:()=>i});let i="auth_token",s="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{db:()=>n});var s=a(8678),r=e([s]);s=(r.then?(await r)():r)[0];let n=global.__pgPool??new s.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});i()}catch(e){i(e)}})},37014:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Gd:()=>d,Gf:()=>m,cB:()=>c,ev:()=>u,fA:()=>_,yg:()=>o,zx:()=>l});var s=a(75748),r=a(65465),n=e([s,r]);function d(e){let t=e.mime_type.startsWith("image/"),a=(0,r.K5)(e);return{id:e.id,originalName:e.original_name,mimeType:e.mime_type,byteSize:Number(e.byte_size),url:`/api/files/${e.id}`,previewUrl:t&&!a?`/api/files/${e.id}?inline=1`:null,isImage:t,expired:!!a||void 0}}async function u(e,t){return(await s.db.query(`
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
    `,[e])).rows){let e=a.entity_id,i=d(a),s=t.get(e)??[];s.push(i),t.set(e,s)}return t}async function l(e){return(await s.db.query(`
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
    `,[e.entityType,e.entityId,e.uploadedBy,e.originalName,e.storageKey,e.mimeType,e.byteSize])).rows[0]}async function m(e){return(await s.db.query(`
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
    `,[e,t])).rows}[s,r]=n.then?(await n)():n,i()}catch(e){i(e)}})},65465:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Hw:()=>o,K5:()=>u});var s=a(75748),r=a(95698),n=e([s]);function d(){let e=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(e)&&e>0?e:30}function u(e){var t;if(t=e.entity_type,"chat_message"!==t&&"task"!==t)return!1;let a=d(),i=new Date(e.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function o(){let e=d(),t=await s.db.connect(),a=0,i=[];try{await t.query("BEGIN");let s=await t.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[e]);if(0===s.rows.length)return await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await t.query("COMMIT"),{filesDeleted:0};let r=s.rows.map(e=>e.id),n=await t.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[r]);for(let e of(a=n.rows.length,n.rows))i.push(e.storage_key);await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await t.query("COMMIT")}catch(e){try{await t.query("ROLLBACK")}catch{}throw e}finally{t.release()}return await Promise.all(i.map(e=>(0,r.Yy)(e))),{filesDeleted:a}}s=(n.then?(await n)():n)[0],i()}catch(e){i(e)}})},95698:(e,t,a)=>{a.d(t,{D0:()=>c,Yy:()=>_,fu:()=>p,q5:()=>m});var i=a(84770),s=a(20629),r=a.n(s),n=a(55315),d=a.n(n);let u=d().join(process.cwd(),"storage","uploads"),o=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),l={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function m(e){let t=d().basename(e),a=t.lastIndexOf(".");return -1===a?"":t.slice(a+1).toLowerCase()}async function c(e,t){let a=m(t);if(!a||!o.has(a))throw Error("unsupported_type");if(e.length>26214400)throw Error("too_large");let s=l[a.toLowerCase()]??"application/octet-stream",n=new Date,c=d().join(String(n.getFullYear()),String(n.getMonth()+1).padStart(2,"0")),_=d().join(u,c);await r().mkdir(_,{recursive:!0});let p=d().basename(t).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),y=`${(0,i.randomUUID)()}_${p||`file.${a}`}`,g=d().join(_,y);return await r().writeFile(g,e),{storageKey:d().join(c,y).replace(/\\/g,"/"),mimeType:s,byteSize:e.length}}async function _(e){let t=d().join(u,e),a=d().normalize(t);if(!a.startsWith(d().normalize(u)))throw Error("invalid_path");await r().unlink(a).catch(()=>void 0)}function p(e){return d().join(u,e)}},61165:(e,t,a)=>{a.d(t,{v6:()=>n});var i=a(41482),s=a.n(i),r=a(1923);function n(e){let t=e.cookies.get(r.l)?.value;return t?function(e){try{let t=s().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[9276,5972,1482,1585],()=>a(79741));module.exports=i})();