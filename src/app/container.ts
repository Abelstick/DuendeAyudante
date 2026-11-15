/**
 * Composition root: el único lugar donde se eligen las implementaciones.
 * Para migrar a una API propia basta con cambiar las clases de aquí
 * (p. ej. SupabaseWishlistRepository → HttpWishlistRepository).
 */
import { ChecklistService } from '@/modules/checklist/application/ChecklistService';
import { SupabaseChecklistRepository } from '@/modules/checklist/infrastructure/SupabaseChecklistRepository';
import { EventService } from '@/modules/events/application/EventService';
import { SupabaseEventRepository } from '@/modules/events/infrastructure/SupabaseEventRepository';
import { FamilyService } from '@/modules/families/application/FamilyService';
import { SupabaseFamilyRepository } from '@/modules/families/infrastructure/SupabaseFamilyRepository';
import { MemberService } from '@/modules/members/application/MemberService';
import { EdgeFunctionMemberAccountService } from '@/modules/members/infrastructure/EdgeFunctionMemberAccountService';
import { SupabaseParticipantRepository } from '@/modules/members/infrastructure/SupabaseParticipantRepository';
import { WishlistService } from '@/modules/wishlist/application/WishlistService';
import { SupabaseWishlistRepository } from '@/modules/wishlist/infrastructure/SupabaseWishlistRepository';
import type { IAuthService } from '@/shared/application/ports/IAuthService';
import { env } from '@/shared/config/env';
import { SupabaseAuthService } from '@/shared/infrastructure/auth/SupabaseAuthService';
import { getSupabaseClient } from '@/shared/infrastructure/supabase/client';

export interface Container {
  auth: IAuthService;
  events: EventService;
  families: FamilyService;
  members: MemberService;
  wishlist: WishlistService;
  checklist: ChecklistService;
}

export function createContainer(): Container {
  const supabase = getSupabaseClient();
  return {
    auth: new SupabaseAuthService(supabase, env.memberEmailDomain),
    events: new EventService(new SupabaseEventRepository(supabase)),
    families: new FamilyService(new SupabaseFamilyRepository(supabase)),
    members: new MemberService(new SupabaseParticipantRepository(supabase), new EdgeFunctionMemberAccountService(supabase)),
    wishlist: new WishlistService(new SupabaseWishlistRepository(supabase)),
    checklist: new ChecklistService(new SupabaseChecklistRepository(supabase)),
  };
}
