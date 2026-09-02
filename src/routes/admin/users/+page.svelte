<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { USER_ROLES } from "$lib/server/admin/roles";
import { formatDate, t } from "$lib/i18n/messages";
import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  const hasNextPage = $derived(data.page * data.pageSize < data.total);

  let roleDraft: Record<string, string> = $state({});

  // A role label is only valid for a known staff role; unknown/null roles show
  // the customer label so a legacy row still renders in the correct language.
  function roleLabel(role: string | null): string {
    const key = USER_ROLES.includes(role as (typeof USER_ROLES)[number]) ? role! : "user";
    return t(lang, `admin.users.roles.${key}`);
  }

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (data.query) params.set("q", data.query);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/admin/users${query ? `?${query}` : ""}`;
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.users.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.users.title")}</SectionTitle>
  <p class="mt-2 text-sm text-cocoa-500">{t(lang, "admin.users.description")}</p>

  <form
    method="GET"
    action="/admin/users"
    role="search"
    class="mt-6 flex max-w-md items-center gap-2"
  >
    <input
      type="search"
      name="q"
      value={data.query}
      placeholder={t(lang, "admin.users.searchPlaceholder")}
      aria-label={t(lang, "admin.users.searchPlaceholder")}
      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
    />
    <Button type="submit" variant="outline">{t(lang, "products.searchSubmit")}</Button>
  </form>

  <p class="mt-4 text-sm text-cocoa-500" role="status">
    {t(lang, "admin.searchResultCount", { count: String(data.total) })}
  </p>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.users.empty")}</p>
    </div>
  {:else}
    <div class="mt-8 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full min-w-max text-sm" data-testid="admin-users-table">
        <thead>
          <tr class="border-b border-cocoa-100 text-left text-xs uppercase tracking-wide text-cocoa-500">
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.name")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.email")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.role")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.createdAt")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-cocoa-100">
          {#each data.items as user (user.id)}
            <tr class="hover:bg-white" data-testid="admin-user-row">
              <td class="px-4 py-3 font-medium text-cocoa-800">{user.name ?? "—"}</td>
              <td class="px-4 py-3 text-cocoa-600">{user.email}</td>
              <td class="px-4 py-3">
                {#if data.canManage}
                  <form method="POST" action="?/setRole" use:enhance>
                    <input type="hidden" name="userId" value={user.id} />
                    <div class="flex items-center gap-2">
                      <select
                        name="role"
                        value={roleDraft[user.id] ?? user.role ?? "user"}
                        aria-label={t(lang, "admin.users.columns.role")}
                        class="rounded-lg border border-cocoa-200 bg-white px-2 py-1 text-sm text-cocoa-900 outline-none focus:border-honey-500"
                        onchange={(event) => {
                          roleDraft[user.id] = (event.currentTarget as HTMLSelectElement).value;
                        }}
                      >
                        {#each USER_ROLES as role (role)}
                          <option value={role}>{t(lang, `admin.users.roles.${role}`)}</option>
                        {/each}
                      </select>
                      <Button type="submit" variant="ghost" class="text-sm">
                        {t(lang, "admin.users.saveRole")}
                      </Button>
                    </div>
                  </form>
                {:else}
                  <span class="text-cocoa-800">{roleLabel(user.role)}</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-cocoa-600">{formatDate(lang, user.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if data.page > 1 || hasNextPage}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} class="btn-outline text-sm">{t(lang, "admin.orders.prev")}</a>
        {/if}
        {#if hasNextPage}
          <a href={pageHref(data.page + 1)} class="btn-outline text-sm">{t(lang, "admin.orders.next")}</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>