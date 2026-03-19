import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: () => import("@/layouts/AppLayout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/pages/home/HomePage.vue"),
        },
        {
          path: "trip/new",
          name: "trip-new",
          component: () => import("@/pages/trip/TripCreatePage.vue"),
        },
        {
          path: "trip/:tripId",
          name: "trip-detail",
          component: () => import("@/pages/trip/TripDetailPage.vue"),
          props: true,
        },
        {
          path: "trip/:tripId/transaction/new",
          name: "transaction-new",
          component: () =>
            import("@/pages/transaction/TransactionCreatePage.vue"),
          props: true,
        },
        {
          path: "trip/:tripId/transaction/:txId/edit",
          name: "transaction-edit",
          component: () =>
            import("@/pages/transaction/TransactionCreatePage.vue"),
          props: true,
        },
        {
          path: "trip/:tripId/settle",
          name: "trip-settle",
          component: () => import("@/pages/settlement/SettlementPage.vue"),
          props: true,
        },
        {
          path: "settings",
          name: "settings",
          component: () => import("@/pages/settings/SettingsPage.vue"),
        },
      ],
    },
    {
      path: "/auth/login",
      name: "login",
      component: () => import("@/pages/auth/LoginPage.vue"),
    },
    {
      path: "/share/:token",
      name: "share-view",
      component: () => import("@/pages/share/ShareViewPage.vue"),
      props: true,
    },
  ],
});

export default router;
