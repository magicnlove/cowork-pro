"use strict";(()=>{var e={};e.id=4619,e.ids=[4619],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},20629:e=>{e.exports=require("fs/promises")},55315:e=>{e.exports=require("path")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},98493:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>_,staticGenerationAsyncStorage:()=>m});var r=a(49303),n=a(88716),s=a(60670),u=a(91084),d=e([u]);u=(d.then?(await d)():d)[0];let c=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/chat/messages/[id]/reactions/route",pathname:"/api/chat/messages/[id]/reactions",filename:"route",bundlePath:"app/api/chat/messages/[id]/reactions/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\chat\\messages\\[id]\\reactions\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:_}=c,p="/api/chat/messages/[id]/reactions/route";function o(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:m})}i()}catch(e){i(e)}})},91084:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.r(t),a.d(t,{POST:()=>_});var r=a(87070),n=a(91585),s=a(75748),u=a(23016),d=a(84995),o=a(22908),c=a(61165),l=e([s,d]);[s,d]=l.then?(await l)():l;let p=n.Ry({emoji:n.Km(["\uD83D\uDC4D","❤️","\uD83D\uDE02","\uD83D\uDE2E","\uD83D\uDE22","\uD83C\uDF89"])});async function m(e,t){let a=await s.db.query(`
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${u.F}
    LIMIT 1
    `,[e,t]);return!!a.rows[0]?.ok}async function _(e,t){let a;let i=(0,c.v6)(e);if(!i)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{id:n}=t.params;try{a=await e.json()}catch{return r.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let u=p.safeParse(a);if(!u.success)return r.NextResponse.json({message:"이모지가 올바르지 않습니다."},{status:400});let l=(await s.db.query("SELECT channel_id::text, deleted_at FROM messages WHERE id = $1::uuid",[n])).rows[0];if(!l)return r.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(l.deleted_at)return r.NextResponse.json({message:"삭제된 메시지에는 반응할 수 없습니다."},{status:400});if(!await m(i.sub,l.channel_id))return r.NextResponse.json({message:"접근할 수 없습니다."},{status:403});(await s.db.query(`
    SELECT 1 FROM message_reactions
    WHERE message_id = $1::uuid AND user_id = $2::uuid AND emoji = $3
    LIMIT 1
    `,[n,i.sub,u.data.emoji])).rowCount?await s.db.query(`
      DELETE FROM message_reactions
      WHERE message_id = $1::uuid AND user_id = $2::uuid AND emoji = $3
      `,[n,i.sub,u.data.emoji]):(await s.db.query(`
      DELETE FROM message_reactions
      WHERE message_id = $1::uuid AND user_id = $2::uuid
      `,[n,i.sub]),await s.db.query(`
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES ($1::uuid, $2::uuid, $3)
      `,[n,i.sub,u.data.emoji]));let _=(await s.db.query(`
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
    `,[n])).rows[0],y=await (0,d.$2)([n],i.sub),E=await (0,d.tq)(_,y.get(n)??[],i.sub);return(0,o.I)(E.channelId,"chat:message:update",E),r.NextResponse.json({message:E})}i()}catch(e){i(e)}})},23016:(e,t,a)=>{a.d(t,{F:()=>i});let i=`
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
`},84995:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{$2:()=>u,Fz:()=>d,tq:()=>o});var r=a(75748),n=a(37014),s=e([r,n]);async function u(e,t){let a=new Map;if(0===e.length)return a;for(let i of(await r.db.query(`
    SELECT
      message_id::text,
      emoji,
      COUNT(*)::text AS cnt,
      BOOL_OR(user_id = $1::uuid) AS self
    FROM message_reactions
    WHERE message_id = ANY($2::uuid[])
    GROUP BY message_id, emoji
    ORDER BY emoji
    `,[t,e])).rows){let e=a.get(i.message_id)??[];e.push({emoji:i.emoji,count:Number(i.cnt),self:i.self}),a.set(i.message_id,e)}return a}function d(e,t,a=[]){return{id:e.id,channelId:e.channel_id,userId:e.user_id,parentMessageId:e.parent_message_id,body:e.body,createdAt:e.created_at.toISOString(),editedAt:e.edited_at?e.edited_at.toISOString():null,deletedAt:e.deleted_at?e.deleted_at.toISOString():null,userName:e.user_name,userEmail:e.user_email,reactions:t,attachments:a}}async function o(e,t,a){let i=await (0,n.yg)([e.id]);return d(e,t,i.get(e.id)??[])}[r,n]=s.then?(await s)():s,i()}catch(e){i(e)}})},22908:(e,t,a)=>{a.d(t,{I:()=>i});function i(e,t,a){let i=globalThis.__chatIoBroadcast;try{i?.(e,t,a)}catch{}}},1923:(e,t,a)=>{a.d(t,{S:()=>r,l:()=>i});let i="auth_token",r="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{db:()=>s});var r=a(8678),n=e([r]);r=(n.then?(await n)():n)[0];let s=global.__pgPool??new r.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});i()}catch(e){i(e)}})},37014:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Gd:()=>u,Gf:()=>l,cB:()=>m,ev:()=>d,fA:()=>_,yg:()=>o,zx:()=>c});var r=a(75748),n=a(65465),s=e([r,n]);function u(e){let t=e.mime_type.startsWith("image/"),a=(0,n.K5)(e);return{id:e.id,originalName:e.original_name,mimeType:e.mime_type,byteSize:Number(e.byte_size),url:`/api/files/${e.id}`,previewUrl:t&&!a?`/api/files/${e.id}?inline=1`:null,isImage:t,expired:!!a||void 0}}async function d(e,t){return(await r.db.query(`
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
    `,[e,t])).rows.map(u)}async function o(e){let t=new Map;if(0===e.length)return t;for(let a of(await r.db.query(`
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
    `,[e])).rows){let e=a.entity_id,i=u(a),r=t.get(e)??[];r.push(i),t.set(e,r)}return t}async function c(e){return(await r.db.query(`
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
    `,[e.entityType,e.entityId,e.uploadedBy,e.originalName,e.storageKey,e.mimeType,e.byteSize])).rows[0]}async function l(e){return(await r.db.query(`
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
    `,[e])).rows[0]??null}async function m(e){return(await r.db.query(`
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
    `,[e])).rows[0]??null}async function _(e,t){return(await r.db.query(`
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
    `,[e,t])).rows}[r,n]=s.then?(await s)():s,i()}catch(e){i(e)}})},65465:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Hw:()=>o,K5:()=>d});var r=a(75748),n=a(95698),s=e([r]);function u(){let e=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(e)&&e>0?e:30}function d(e){var t;if(t=e.entity_type,"chat_message"!==t&&"task"!==t)return!1;let a=u(),i=new Date(e.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function o(){let e=u(),t=await r.db.connect(),a=0,i=[];try{await t.query("BEGIN");let r=await t.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[e]);if(0===r.rows.length)return await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await t.query("COMMIT"),{filesDeleted:0};let n=r.rows.map(e=>e.id),s=await t.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[n]);for(let e of(a=s.rows.length,s.rows))i.push(e.storage_key);await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await t.query("COMMIT")}catch(e){try{await t.query("ROLLBACK")}catch{}throw e}finally{t.release()}return await Promise.all(i.map(e=>(0,n.Yy)(e))),{filesDeleted:a}}r=(s.then?(await s)():s)[0],i()}catch(e){i(e)}})},95698:(e,t,a)=>{a.d(t,{D0:()=>m,Yy:()=>_,fu:()=>p,q5:()=>l});var i=a(84770),r=a(20629),n=a.n(r),s=a(55315),u=a.n(s);let d=u().join(process.cwd(),"storage","uploads"),o=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),c={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function l(e){let t=u().basename(e),a=t.lastIndexOf(".");return -1===a?"":t.slice(a+1).toLowerCase()}async function m(e,t){let a=l(t);if(!a||!o.has(a))throw Error("unsupported_type");if(e.length>26214400)throw Error("too_large");let r=c[a.toLowerCase()]??"application/octet-stream",s=new Date,m=u().join(String(s.getFullYear()),String(s.getMonth()+1).padStart(2,"0")),_=u().join(d,m);await n().mkdir(_,{recursive:!0});let p=u().basename(t).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),y=`${(0,i.randomUUID)()}_${p||`file.${a}`}`,E=u().join(_,y);return await n().writeFile(E,e),{storageKey:u().join(m,y).replace(/\\/g,"/"),mimeType:r,byteSize:e.length}}async function _(e){let t=u().join(d,e),a=u().normalize(t);if(!a.startsWith(u().normalize(d)))throw Error("invalid_path");await n().unlink(a).catch(()=>void 0)}function p(e){return u().join(d,e)}},61165:(e,t,a)=>{a.d(t,{v6:()=>s});var i=a(41482),r=a.n(i),n=a(1923);function s(e){let t=e.cookies.get(n.l)?.value;return t?function(e){try{let t=r().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[9276,5972,1482,1585],()=>a(98493));module.exports=i})();