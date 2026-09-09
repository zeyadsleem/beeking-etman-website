import { oc } from "@orpc/contract";
import { z } from "zod";

export const departmentSchema = z.enum(["honey", "equipment"]);

export const searchSuggestionProductSchema = z.object({
  name: z.string(),
  slug: z.string(),
  categorySlug: z.string(),
  department: departmentSchema,
  image: z.string(),
  minPrice: z.number(),
});

export const searchSuggestionCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const searchSuggestionsInputSchema = z.object({
  q: z.string().min(2).max(100),
});

export const searchSuggestionsOutputSchema = z.object({
  products: z.array(searchSuggestionProductSchema),
  categories: z.array(searchSuggestionCategorySchema),
});

export const searchContract = oc
  .errors({
    TOO_MANY_REQUESTS: {},
  })
  .router({
    suggestions: oc.input(searchSuggestionsInputSchema).output(searchSuggestionsOutputSchema),
  });
