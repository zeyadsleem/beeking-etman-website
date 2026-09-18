<script lang="ts">
  import { scrollable } from "$lib/actions/scrollable";
  import { enhance } from "$app/forms";
  import Search from "@lucide/svelte/icons/search";
  import UsersRound from "@lucide/svelte/icons/users-round";
  import EmptyState from "$lib/components/admin/EmptyState.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { USER_ROLES, type UserRole } from "$lib/admin-roles";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  const hasNextPage = $derived(data.page * data.pageSize < data.total);
  const pageCount = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  let roleDraft: Record<string, string> = $state({});

  // A role label is only valid for a known staff role; unknown/null roles show
  // the customer label so a legacy row still renders in the correct language.
  function roleLabel(role: string | null): string {
    const key = USER_ROLES.includes(role as (typeof USER_ROLES)[number]) ? role! : "user";
    return t(lang, `admin.users.roles.${key}`);
  }

  // Initials gravatar-style avatar: first letter of first and last name-word.
  function initials(name: string | null): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase() || "؟";
  }

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (data.query) params.set("q", data.query);
    if (data.role) params.set("role", data.role);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/admin/users${query ? `?${query}` : ""}`;
  }

  function roleHref(role: UserRole | null): string {
    const params = new URLSearchParams();
    if (data.query) params.set("q", data.query);
    if (role) params.set("role", role);
    params.delete("page");
    const query = params.toString();
    return `/admin/users${query ? `?${query}` : ""}`;
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.users.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.users.title")}</SectionTitle>
  <p class="mt-2 text-sm text-cocoa-500">{t(lang, "admin.users.description")}</p>

  <form
    method="GET"
    action="/admin/users"
    role="search"
    class="mt-6 flex max-w-md items-center gap-2"
  >
    <div class="relative w-full">
      <Search
        class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400"
        aria-hidden="true"
      />
      <input
        type="search"
        name="q"
        value={data.query}
        placeholder={t(lang, "admin.users.searchPlaceholder")}
        aria-label={t(lang, "admin.users.searchPlaceholder")}
        class="w-full rounded-xl border border-cocoa-200 bg-white py-2 pe-3 ps-9 text-sm text-cocoa-900 outline-none focus:border-honey-500"
      />
    </div>
    <Button type="submit" variant="outline">{t(lang, "products.searchSubmit")}</Button>
  </form>

  <nav class="mt-5 flex flex-wrap items-center gap-2" aria-label={t(lang, "admin.users.filterAria")}>
    <a
      href={roleHref(null)}
      aria-current={data.role === null ? "page" : undefined}
      class="chip {data.role === null ? 'chip-active' : ''}"
    >
      {t(lang, "admin.users.filterAll")}
    </a>
    {#each USER_ROLES as role (role)}
      <a
        href={roleHref(role)}
        aria-current={data.role === role ? "page" : undefined}
        class="chip {data.role === role ? 'chip-active' : ''}"
      >
        {t(lang, `admin.users.roles.${role}`)}
      </a>
    {/each}
  </nav>

  <p class="mt-5 text-sm text-cocoa-500" role="status">
    {t(lang, "admin.searchResultCount", { count: String(data.total) })}
  </p>

  {#if data.items.length === 0}
    <div class="mt-8">
      <EmptyState
        title={t(lang, "admin.users.empty")}
        description={t(lang, "admin.users.emptyHint")}
        icon={UsersRound}
      />
    </div>
  {:else}
    <div role="region" use:scrollable aria-label={t(lang, "admin.users.title")} class="mt-8 hidden overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm md:block" data-testid="admin-users-table">
      <table class="w-full min-w-max text-sm">
        <thead>
          <tr class="border-b border-cocoa-100 text-left text-xs uppercase tracking-wide text-cocoa-500">
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.name")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.email")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.role")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.users.columns.createdAt")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-cocoa-100">
          {#each data.items as user, id (user.id)}
            <tr class="transition-colors hover:bg-white {(id & 1) === 1 ? 'bg-cocoa-50/30' : 'bg-transparent'}" data-testid="admin-user-row">
              <td class="px-4 py-3">
                <span class="flex items-center gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-honey-100 text-xs font-bold text-honey-700">
                    {initials(user.name)}
                  </span>
                  <span class="font-medium text-cocoa-800">{user.name ?? "—"}</span>
                </span>
              </td>
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
                  <span class="rounded-full bg-cocoa-100 px-2.5 py-0.5 text-xs font-semibold text-cocoa-700">
                    {roleLabel(user.role)}
                  </span>
                {/if}
              </td>
              <td class="px-4 py-3 text-cocoa-600">{formatDate(lang, user.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <ul class="mt-8 grid gap-3 md:hidden" data-testid="admin-users-cards">
      {#each data.items as user (user.id)}
        <li class="min-w-0 rounded-2xl border border-cocoa-100 bg-parchment p-4 shadow-warm-sm">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey-100 text-sm font-bold text-honey-700">
              {initials(user.name)}
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium text-cocoa-800">{user.name ?? "—"}</p>
              <p class="truncate text-xs text-cocoa-500">{user.email}</p>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2">
            <span class="rounded-full bg-cocoa-100 px-2.5 py-0.5 text-xs font-semibold text-cocoa-700">
              {roleLabel(user.role)}
            </span>
            {#if data.canManage}
              <form method="POST" action="?/setRole" use:enhance>
                <input type="hidden" name="userId" value={user.id} />
                <div class="flex items-center gap-2">
                  <select
                    name="role"
                    value={roleDraft[user.id] ?? user.role ?? "user"}
                    aria-label={t(lang, "admin.users.columns.role")}
                    class="rounded-lg border border-cocoa-200 bg-white px-2 py-1 text-xs text-cocoa-900 outline-none focus:border-honey-500"
                    onchange={(event) => {
                      roleDraft[user.id] = (event.currentTarget as HTMLSelectElement).value;
                    }}
                  >
                    {#each USER_ROLES as role (role)}
                      <option value={role}>{t(lang, `admin.users.roles.${role}`)}</option>
                    {/each}
                  </select>
                  <Button type="submit" variant="ghost" class="text-xs">
                    {t(lang, "admin.users.saveRole")}
                  </Button>
                </div>
              </form>
            {/if}
          </div>
          <p class="mt-2 text-xs text-cocoa-400">
            {t(lang, "admin.users.columns.createdAt")}: {formatDate(lang, user.createdAt)}
          </p>
        </li>
      {/each}
    </ul>

    {#if data.page > 1 || hasNextPage}
      <nav
        class="mt-10 flex items-center justify-center gap-2"
        aria-label={t(lang, "products.paginationAria")}
      >
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} class="btn-outline px-3 text-sm">{t(lang, "admin.orders.prev")}</a>
        {/if}
        {#each Array.from({ length: pageCount }, (_, i) => i + 1) as pg (pg)}
          <a
            href={pg === data.page ? undefined : pageHref(pg)}
            aria-current={pg === data.page ? "page" : undefined}
            aria-label={t(lang, "products.pageAria", { n: String(pg) })}
            class="flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors {pg === data.page
              ? 'border-honey-600 bg-honey-600 text-white'
              : 'border-cocoa-200 bg-parchment text-cocoa-600 hover:border-honey-500 hover:text-honey-700'}"
          >
            {pg}
          </a>
        {/each}
        {#if hasNextPage}
          <a href={pageHref(data.page + 1)} class="btn-outline px-3 text-sm">{t(lang, "admin.orders.next")}</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>
