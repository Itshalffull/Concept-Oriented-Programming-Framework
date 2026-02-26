// generated: notification.types.ts

export interface NotificationRegisterChannelInput {
  name: string;
  config: string;
}

export type NotificationRegisterChannelOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface NotificationDefineTemplateInput {
  notification: string;
  template: string;
}

export type NotificationDefineTemplateOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface NotificationSubscribeInput {
  user: string;
  eventType: string;
  channel: string;
}

export type NotificationSubscribeOutput =
  { variant: "ok" }
  | { variant: "exists"; message: string };

export interface NotificationUnsubscribeInput {
  user: string;
  eventType: string;
  channel: string;
}

export type NotificationUnsubscribeOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface NotificationNotifyInput {
  notification: string;
  user: string;
  template: string;
  data: string;
}

export type NotificationNotifyOutput =
  { variant: "ok" }
  | { variant: "error"; message: string };

export interface NotificationMarkReadInput {
  notification: string;
}

export type NotificationMarkReadOutput =
  { variant: "ok" }
  | { variant: "notfound"; message: string };

export interface NotificationGetUnreadInput {
  user: string;
}

export type NotificationGetUnreadOutput =
  { variant: "ok"; notifications: string };

