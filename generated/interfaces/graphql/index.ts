// Auto-generated entrypoint for kit "conduit", target "graphql"
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { ArticleTypeDefs, ArticleResolvers } from './Article/Article.schema';
import { CommentTypeDefs, CommentResolvers } from './Comment/Comment.schema';
import { EchoTypeDefs, EchoResolvers } from './Echo/Echo.schema';
import { FavoriteTypeDefs, FavoriteResolvers } from './Favorite/Favorite.schema';
import { FollowTypeDefs, FollowResolvers } from './Follow/Follow.schema';
import { JWTTypeDefs, JWTResolvers } from './JWT/JWT.schema';
import { PasswordTypeDefs, PasswordResolvers } from './Password/Password.schema';
import { ProfileTypeDefs, ProfileResolvers } from './Profile/Profile.schema';
import { TagTypeDefs, TagResolvers } from './Tag/Tag.schema';
import { UserTypeDefs, UserResolvers } from './User/User.schema';

export const typeDefs = mergeTypeDefs([ArticleTypeDefs, CommentTypeDefs, EchoTypeDefs, FavoriteTypeDefs, FollowTypeDefs, JWTTypeDefs, PasswordTypeDefs, ProfileTypeDefs, TagTypeDefs, UserTypeDefs]);
export const resolvers = mergeResolvers([ArticleResolvers, CommentResolvers, EchoResolvers, FavoriteResolvers, FollowResolvers, JWTResolvers, PasswordResolvers, ProfileResolvers, TagResolvers, UserResolvers]);
