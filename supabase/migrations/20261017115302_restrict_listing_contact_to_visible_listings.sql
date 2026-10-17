-- The public view already applies listing SELECT policies. Direct RPC calls
-- must enforce the same visibility boundary before returning seller contact.
-- Keep this function SECURITY DEFINER: contact has no direct SELECT grant.
CREATE OR REPLACE FUNCTION public.get_masked_seller_contact(p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT ml.seller_contact
  FROM public.mineral_listings AS ml
  WHERE ml.id = p_listing_id
    AND auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND (
      ml.seller_id = auth.uid()
      OR public.is_moderator()
      OR (ml.status = 'verified' AND ml.listing_state = 'active')
    );
$function$;

-- Anonymous reads of the public view continue to receive NULL contact.
-- Do not revoke this permission without also changing that view.
COMMENT ON FUNCTION public.get_masked_seller_contact(uuid) IS
  'Contact for signed-in identities only, limited to active verified listings, their owner, or moderators. Anonymous and invisible listings return NULL.';
