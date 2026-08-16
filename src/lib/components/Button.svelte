<script lang="ts">
  import { Button } from "bits-ui";

  let {
    variant = "primary",
    href,
    type,
    disabled = false,
    class: className = "",
    children,
    ...restProps
  }: {
    variant?: "primary" | "outline" | "ghost";
    href?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    class?: string;
    children: import("svelte").Snippet;
  } & Record<string, unknown> = $props();

  const variantClass = $derived(
    {
      primary: "btn-primary",
      outline: "btn-outline",
      ghost: "btn-ghost",
    }[variant],
  );

  const elementProps = $derived(
    href
      ? { href, type: undefined, disabled: undefined }
      : { href: undefined, type, disabled },
  );
</script>

<Button.Root {...elementProps} {disabled} class={`${variantClass} ${className}`} {...restProps}>
  {@render children()}
</Button.Root>