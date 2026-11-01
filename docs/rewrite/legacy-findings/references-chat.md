# Findings: reference library and knowledge assistant

Specs written: `openspec/specs/reference-library/spec.md`, `openspec/specs/knowledge-assistant/spec.md`.

## Dead or unwired code
- `src/components/ReferenceSelector.tsx:1-116` is never imported. It is a checklist of reference documents (Select All / Clear) meant to limit chat retrieval to chosen documents. Its `referenceSelector.*` translation keys are unused. Not specced.
- `src/components/ConversationList.tsx:1-34` is never mounted. Only its `Conversation` type import exists; `Chat.tsx:370-397` has its own inline list.
- `src/components/ImageViewer.tsx` is never imported. It is a gallery of retrieved figures with a broken-image fallback and a "referenced in N sources" note. Its `imageViewer.*` keys are unused.
- `src/services/retrievalService.ts` is only referenced by dead code (`ImageViewer`, `contextFormatter`). It holds client-side retrieval: query embedding through `generate-embeddings`, top-k 5, threshold 0.5, a document filter, adjacent-passage expansion and image dedup. It also wraps the RPC helpers. Adjacent expansion could never work because the stored prev/next ids are `"chunk-N"` strings (`documentChunker.ts:92-99`), not row ids (`retrievalService.ts:186-189`).
- `src/utils/contextFormatter.ts` is unused. It is another prompt formatter ("## Source n - title / heading", relevance %, a figure list) that feeds `RAG_CONFIG.llm.systemPromptTemplate`.
- `src/services/imageStorageService.ts` is unused; the edge function does the uploads. Its `deleteDocumentImages` (L187) is never called, so stored figures are never cleaned up.
- `src/utils/latexRenderer.tsx` is unused, a placeholder parser. The live renderer is `markdownRenderer.tsx`.
- Unused exports:
  - `latexPreserver.ts`: `extractEquationLabels`, `protectLatex`, `restoreLatex`, `validateLatexSyntax` (L119-216).
  - `imageExtractor.ts`: `deduplicateImages`, `isValidImageFormat`, `generateImageStoragePath` (L196-226).
  - `embeddingService.ts`: `checkEmbeddingsExist`, `deleteEmbeddings` (L254-280).
- `src/config/ragConfig.ts`: only `documentProcessing.chunkSize/chunkOverlap`, `latex.*` and `imagePatterns.*` are live. The `embedding`, `vectorDatabase`, `imageStorage`, `retrieval` and `llm` sections are unused. The unused `llm.systemPromptTemplate` (L46-60) has different rules from the live prompt ("If the answer is not in the sources, say so clearly", "[Source N]" citations).
- `supabase/functions/generate-embeddings/index.ts:96-112`: the query-embedding mode is only used by the dead `retrievalService`.
- `supabase/functions/ask-llm/index.ts`: no caller sends `referenceDocumentIds` (L18, L128-130) or `modelName` (L19, L71). `modelName` is ignored anyway; the model is hard-coded at L251.
- DB functions `search_chunks_by_section`, `get_chunks_with_equations` and `get_chunks_with_images`, plus their metadata indexes (`20251007000000_enhance_embeddings_for_rag.sql:47-146`), are only used by dead code.
- `check_embeddings.sql` is an empty file (1 byte).
- Stale comments:
  - `embeddingService.ts:96` says "Supabase built-in AI".
  - `ragConfig.ts:13-14` says nomic-embed-text.
  - `20251007000000_enhance_embeddings_for_rag.sql:15-18` says a storage bucket is created; none is. The bucket is created lazily by `upload-reference-images/index.ts:129-148`.

## Bugs and inconsistencies
- **Embedding dimension history.** The final state is 768:
  - 1536 for Voyage (`20251005135751_create_qa_conversations_and_embeddings.sql:132`).
  - 768 for nomic (`20251013000000_update_embedding_dimension_768.sql:9`).
  - 384 for gte-small (`20251014000000_update_embedding_dimension_384.sql:9`).
  - 768 for the column (`20251015230532_remote_schema.sql:1`), with the search function at 768 (`20251015230600_update_search_function_768.sql:10`, re-created at `20251121000000_share_references_across_users.sql:127-158`).

  768 matches the Google `text-embedding-004` model used in `generate-embeddings/index.ts:28-37` and `ask-llm/index.ts:82-96`. The 384→768 cast cannot convert existing 384-d rows, so the data must have been wiped and re-indexed. The spec records the "same model / re-index on change" rule. The search join also switched from LEFT JOIN (20251013/20251014/20251015230600) to an inner JOIN (20251121000000:152).
- **Chat history lost.** `20251014100000_remove_qa_tables.sql` drops conversations and messages, and `20251014110000_restore_qa_tables.sql` re-creates them empty, so earlier chat history was lost.
- **Figure ID and caption extraction is broken by global regexes.** `imageExtractor.ts:68-71` and `:77-80` call `.match()` with global regexes (`ragConfig.ts:73-74`). That returns full-match strings, so `figMatch[1]` is `undefined` when there is one match, and the wrong text when there are several.
  - Result: `figure_id` is undefined whenever the alt text or the following caption has "Fig. X.Y-Z".
  - Those images upload as `<doc>/undefined.<ext>` (`upload-reference-images/index.ts:232`).
  - They collapse onto one map key (`embeddingService.ts:158`).
  - The chat drops them (`Chat.tsx:213-221`).
  - Caption extraction has the same bug (`imageExtractor.ts:116-118`).

  Specced the intended ID and caption rules.
- **LaTeX detection.** `latexPreserver.ts:80` `hasLatexEquations` calls `.test` on shared global regexes, and the leftover `lastIndex` causes intermittent false negatives. In `latexPreserver.ts:98-112` the second branch is unreachable because the first condition already covers it. Specced "extend the passage to the end of the formula".
- **Chunk offsets drift.** `documentChunker.ts:41-63` computes chunk offsets from the rebuilt string (trimmed paragraphs joined with "\n\n") instead of the original positions. Offsets drift with 3+ newlines or surrounding whitespace, and that skews range-based image association. Other inconsistencies:
  - Non-final chunks take their text from the original substring (L46); the final chunk uses the rebuilt string (L77).
  - The overlap (L60) can cut mid-word or mid-formula.
  - Paragraphs over 1000 characters are never split.
- **Re-indexing is not atomic.** `embeddingService.ts:78-88` deletes the old passages before generating new ones, so a failure leaves the document unsearchable. Spec: atomic replace.
- **No batching in embedding generation.** `generate-embeddings/index.ts:120-122` embeds all passages in parallel with no batching or retry, so large documents can hit provider rate limits and fail completely. `RAG_CONFIG.embedding.batchSize` is unused.
- **Stale passages stay searchable.** `ReferenceEditor.tsx:88` re-indexes only when content is non-empty and the box is checked. Clearing the content leaves the old passages searchable. Spec: empty content removes passages; unchecked keeps them (see open questions).
- **Duplicate documents.** `ReferenceEditor.tsx:94-98`: when indexing of a NEW document fails, the editor stays open with `document` still null, so the next Save inserts a duplicate (L61-85). Spec: update the same document.
- **Image warning never visible.** `ReferenceEditor.tsx:107` sets the image-failure warning, then `onSave()` at L112 immediately unmounts the editor, so the warning is never seen.
- **Upload filter.** In `ReferencesList.tsx:98` the extension check is case-sensitive, so `.MD` is rejected. `ReferencesList.tsx:167-169` is a no-op check.
- **Deep links.** `App.tsx:160-172` only acts when `docId` is present:
  - Loading `/references?mode=edit` fresh shows the list.
  - Browser Back to `/references` does not return to the list, because the mode is component state, not derived from the URL.
  - An unknown `docId` is silently ignored.

  Spec: state is driven by the URL.
- **Markdown renderer gaps.** `markdownRenderer.tsx` renders headings h1-h3 only (L207-227). Images `![]()`, links, tables, ordered lists, blockquotes and h4-h6 show as raw text, even though documents embed images by design. Specced image rendering. `Chat.tsx:243,271` renders each "\n\n" paragraph separately, which breaks code or display-math blocks that contain blank lines. `ReferenceViewer.tsx` has no dark-mode styles, unlike the list and editor.
- **Sources leak between conversations.** `Chat.tsx:26,68-73`: `citations` is only cleared by "New" or by sending. Selecting another conversation (L379) keeps the previous answer's sources and figures and shows them under that conversation's last answer (L196-200). Older answers never show their sources or figures, although they are stored in message metadata (`ask-llm/index.ts:240-243,417-420`). Spec: sources belong to their own answer.
- **Source links fail for non-admins.** `Chat.tsx:333` links sources to `/references?docId=`. For non-admins that route is not registered (`App.tsx:583-588`), so the link redirects to `/builds`. Spec: no link for non-admins.
- **Stale conversation after first answer.** In `Chat.tsx:190` the `activeId` in `finally` is a stale closure. The first answer of a new conversation is not reloaded from the server.
- **Mid-stream errors are swallowed.** `chatService.ts:106-119` throws on stream `error` events, but its own catch swallows them unless the message starts with "Stream error". The user sees nothing and an empty answer bubble stays. Spec: show the error.
- **Empty conversations on refusal.** `ask-llm/index.ts:186-202` creates the new conversation before the relevance check at L217-232. When nothing relevant is found, an empty conversation titled with the question is left in the list. Spec: no conversation is created.
- **Refusal text.** `ask-llm/index.ts:219` hard-codes the no-relevant-info message in English, and it tells users to "upload documents", which only admins can do. Spec: localized.
- **HTTP status codes.** In `ask-llm/index.ts:46,68,74`, auth failures and an empty question are thrown and come back as HTTP 500 (L451-464). Only "no context" returns 400. Spec: 401 and 400.
- **Unbounded history.** `ask-llm/index.ts:175-185` sends the whole conversation history every turn with no cap.
- **Document filter.** `ask-llm/index.ts:128-130` applies the document filter after taking the top 10. It is dead anyway.
- **Hard-coded experimental model.** `ask-llm/index.ts:24` hard-codes the experimental model id `gemini-2.0-flash-exp` (also `ragConfig.ts:43`). The provider may withdraw experimental ids, and the operator cannot configure it.
- **Admins see everyone's chats.** The RLS note at `20251121170000_fix_user_profiles_visibility.sql:112-115` says admins still only see their own data in user sections. That is false: policies are OR'd, so the admin's Chat lists every user's conversations (`chatService.ts:26-33` has no owner filter). This contradicts the intent of `20251121000001_fix_admin_rls_policies.sql:23-44`. Spec: own conversations only.
- **Non-standard image types.** In `upload-reference-images/index.ts:216-224`, image types other than JPEG, GIF or WebP (for example SVG, which `ragConfig.ts:30` allows) are stored with a `.png` extension and the original content type. The bucket's MIME allow-list (L138-140) would then reject SVG.
- **Hard-coded dev URLs.** `upload-reference-images/index.ts:158-181` has hard-coded local-dev URL rewriting (`kong:8000` → `127.0.0.1:54321`) and checks for the "supabase.co" substring.
- **Misleading key usage.** `generate-embeddings/index.ts:77-83` builds a service-role client but overrides Authorization with the user JWT, so inserts run under the user's RLS. It works for admins through `20251118000000_add_user_profiles_and_admin_roles.sql:226-241`, but it is misleading.
- **Misleading UI wording.** The placeholder "Ask a question about your reference documents…" and the label "Generate embeddings (requires Google AI API key)" suggest per-user documents and keys. The library is shared and the key is server-side.

## Security and data-integrity concerns
- **Non-admins can write to the library.** RLS lets ANY authenticated user:
  - insert reference documents (`20251121000000_share_references_across_users.sql:40-42`);
  - update or delete their own documents (L45-74);
  - write index passages for their own documents (L89-124).

  Admin-only management is enforced only in the UI (`App.tsx:583-588`). A regular user can inject passages into the shared knowledge base that every user's assistant retrieves (poisoning or prompt injection). Spec requires admin-only writes on the server.
- **Stored XSS.** `markdownRenderer.tsx:53-61,96-104` puts unescaped text into `dangerouslySetInnerHTML`. Stored XSS can come from reference content (writable by any user, see above) and from LLM answers (`Chat.tsx:271`), which can echo passage text. The wood analysis modal uses the same renderer. Spec requires safe rendering.
- **SSRF and image overwrite.** `upload-reference-images/index.ts:52-67,184-195` runs with the service role and has no admin or document-ownership check. Any signed-in user can:
  - make the server fetch arbitrary http(s) URLs, including internal hosts (SSRF);
  - write into the public bucket at any `<documentId>/<figureId>` with `upsert: true` (L241), overwriting another document's figures.
- **Public bucket with no policies.** The public bucket `reference-images` has no storage policies in migrations. Figures are never deleted when a document is deleted, so orphaned public files accumulate.
- **No usage limits.** `ask-llm` and `generate-embeddings` have no rate limit, quota or maximum question length. The query-embedding mode lets any user spend the paid embedding API. CORS is `*`.
- **Raw provider errors reach users.** `ask-llm/index.ts:101,305` and `generate-embeddings/index.ts:46` pass raw provider error bodies through to the UI.
- **Deleting an author deletes the library.** Reference documents use `ON DELETE CASCADE` on their creator (`20251006000000_add_authentication.sql:23`), and the admin delete-user function explicitly deletes that user's reference documents (`20251121220000_add_admin_delete_user_function.sql:65-66`). Deleting the admin who wrote the shared library wipes it and its index.
- **Admins can write into others' conversations.** Admin SELECT on all conversations and messages (`20251121170000_fix_user_profiles_visibility.sql:70-82`) combines with admin INSERT on messages (`20251118000000_add_user_profiles_and_admin_roles.sql:214-216`). An admin calling `ask-llm` with another user's `conversationId` gets that user's history and appends messages to their conversation.
- **Silent loss for foreign conversations.** When a non-owner passes someone else's `conversationId`, RLS blocks the history and the inserts fail silently (`ask-llm/index.ts:245-247` only logs). The answer streams but is lost.
- **Secrets.** No hard-coded secrets were found in client or function code in this area. The functions read `GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` from the environment.

## Open questions for the owner
- Should non-admin users get read-only access to a cited reference document? RLS already lets them read all documents. The spec makes sources non-links for non-admins.
- Should answers follow the UI language (EN/FR)? The live prompt has no language rule (`ask-llm/index.ts:205-216`). Not specced.
- Should the chat let users limit retrieval to selected documents (dead `ReferenceSelector`), or should that feature be dropped?
- What rate limits, timeouts, maximum question length and history window should the assistant have? None exist today; none are specced.
- When an admin saves with "Generate embeddings" unchecked, should the old passages be kept (specced) or should the document be flagged as not indexed? Should the list show index status (passage count, last indexed)?
- How much Markdown should the rewrite support: tables, links, ordered lists, h4-h6? The spec gives a minimum that includes images.
- When nothing relevant is retrieved, the wood analysis also fails. Should non-chat callers be allowed to answer from general knowledge?
- Should the Markdown be rewritten to point at the stored figure copies, so the viewer does not depend on external hosts?
- Should reference documents survive the deletion of the user who created them?
- Should users be able to rename conversations? It is not supported today.
- The sources list shows every retrieved passage (up to 10), not only the ones the answer cites. Should it be filtered to cited passages?
- The file-name fallback for figure IDs can collide (same stem, same storage path). Is a unique suffix needed?
